import { BugDetectionAgent } from './detectorAgent.js';
import { RiskClassificationAgent } from './riskAgent.js';
import { PatchGenerationAgent } from './patchAgent.js';
import { PipelineValidationAgent } from './pipelineAgent.js';
import { CanaryDeploymentAgent } from './canaryAgent.js';
import { store } from '../services/store.js';

export class MultiAgentOrchestrator {
  constructor(wsBroadcaster) {
    this.wsBroadcaster = wsBroadcaster;
    this.detector = new BugDetectionAgent();
    this.riskAgent = new RiskClassificationAgent();
    this.patchAgent = new PatchGenerationAgent();
    this.pipelineAgent = new PipelineValidationAgent();
    this.canaryAgent = new CanaryDeploymentAgent();
  }

  broadcast(type, payload) {
    if (this.wsBroadcaster) {
      this.wsBroadcaster({ type, payload, timestamp: new Date().toISOString() });
    }
  }

  async processIssue(issueId) {
    const issue = store.getIssue(issueId);
    if (!issue) return;

    const application = store.getApplication(issue.applicationId);
    if (!application) return;

    let pipelineRun = store.getPipelineRun(issueId);
    if (!pipelineRun) {
      pipelineRun = store.addPipelineRun({
        id: `PIPE-${Date.now()}`,
        issueId,
        applicationId: application.id,
        status: 'RUNNING',
        currentStep: 'DETECTION',
        logs: [],
        startedAt: new Date().toISOString()
      });
    }

    const appendLogs = (agentLogs) => {
      pipelineRun.logs = pipelineRun.logs.concat(agentLogs);
      store.updatePipelineRun(pipelineRun.id, { logs: pipelineRun.logs });
      this.broadcast('PIPELINE_LOGS', { issueId, logs: agentLogs, currentStep: pipelineRun.currentStep });
    };

    try {
      // Step 1: Bug Detection & Root Cause Analysis
      store.updateIssue(issueId, { status: 'IN_ANALYSIS' });
      pipelineRun.currentStep = 'DETECTION';
      this.broadcast('PIPELINE_STEP', { issueId, step: 'DETECTION', status: 'IN_PROGRESS' });
      
      await new Promise(r => setTimeout(r, 600)); // Smooth step animation
      const detectionResult = await this.detector.analyze(issue, application);
      appendLogs(detectionResult.logs);

      store.updateIssue(issueId, { rootCause: detectionResult.rootCauseSummary });

      if (!detectionResult.isValidBug) {
        store.updateIssue(issueId, { status: 'INVALID_REPORT', riskLevel: 'NONE', riskScore: 0 });
        store.updatePipelineRun(pipelineRun.id, { status: 'REJECTED_INVALID', completedAt: new Date().toISOString() });
        this.broadcast('PIPELINE_STEP', { issueId, step: 'DETECTION', status: 'INVALID_REPORT', result: detectionResult });
        this.broadcast('PIPELINE_FINISHED', {
          issueId,
          status: 'INVALID_REPORT',
          applicationId: application.id,
          applicationPort: application.port,
          reason: detectionResult.rootCauseSummary
        });
        return; // Stop pipeline early!
      }

      this.broadcast('PIPELINE_STEP', { issueId, step: 'DETECTION', status: 'COMPLETED', result: detectionResult });

      // Step 2: Risk Classification
      pipelineRun.currentStep = 'RISK_ASSESSMENT';
      this.broadcast('PIPELINE_STEP', { issueId, step: 'RISK_ASSESSMENT', status: 'IN_PROGRESS' });
      
      await new Promise(r => setTimeout(r, 600));
      const riskResult = await this.riskAgent.classify(detectionResult, issue);
      appendLogs(riskResult.logs);

      store.updateIssue(issueId, { riskLevel: riskResult.riskLevel, riskScore: riskResult.riskScore });
      this.broadcast('PIPELINE_STEP', { issueId, step: 'RISK_ASSESSMENT', status: 'COMPLETED', result: riskResult });

      // Step 3: Patch Generation
      pipelineRun.currentStep = 'PATCH_GENERATION';
      this.broadcast('PIPELINE_STEP', { issueId, step: 'PATCH_GENERATION', status: 'IN_PROGRESS' });
      
      await new Promise(r => setTimeout(r, 600));
      const patchResult = await this.patchAgent.generate(detectionResult, riskResult);
      appendLogs(patchResult.logs);

      const patch = store.addPatch({
        id: `PATCH-${Date.now()}`,
        issueId,
        applicationId: application.id,
        diff: patchResult.diff,
        description: patchResult.description,
        status: riskResult.requiresAdminApproval ? 'PENDING_APPROVAL' : 'APPROVED',
        patchResult
      });

      this.broadcast('PIPELINE_STEP', { issueId, step: 'PATCH_GENERATION', status: 'COMPLETED', result: patchResult });

      // Governance Gate Check for High-Risk Issues
      if (riskResult.requiresAdminApproval && patch.status === 'PENDING_APPROVAL') {
        store.updateIssue(issueId, { status: 'AWAITING_ADMIN_APPROVAL' });
        store.updatePipelineRun(pipelineRun.id, { status: 'PAUSED_AWAITING_APPROVAL', currentStep: 'ADMIN_REVIEW' });
        this.broadcast('PIPELINE_PAUSED', {
          issueId,
          reason: 'High Risk classification requires Customer Admin manual review.',
          patchId: patch.id,
          riskResult
        });
        return; // Pause pipeline until manual approval API call
      }

      // Resume or Continue Automated Pipeline for Low Risk
      await this.executeDeploymentPipeline(issueId, patchResult, application, pipelineRun);

    } catch (err) {
      console.error('Pipeline error:', err);
      store.updateIssue(issueId, { status: 'FAILED' });
      store.updatePipelineRun(pipelineRun.id, { status: 'FAILED' });
      this.broadcast('PIPELINE_FAILED', { issueId, error: err.message });
    }
  }

  async executeDeploymentPipeline(issueId, patchResult, application, pipelineRun) {
    const appendLogs = (agentLogs) => {
      pipelineRun.logs = pipelineRun.logs.concat(agentLogs);
      store.updatePipelineRun(pipelineRun.id, { logs: pipelineRun.logs });
      this.broadcast('PIPELINE_LOGS', { issueId, logs: agentLogs, currentStep: pipelineRun.currentStep });
    };

    // Step 4: Security Analysis & CI/CD Pipeline
    pipelineRun.currentStep = 'CICD_PIPELINE';
    store.updatePipelineRun(pipelineRun.id, { status: 'RUNNING', currentStep: 'CICD_PIPELINE' });
    this.broadcast('PIPELINE_STEP', { issueId, step: 'CICD_PIPELINE', status: 'IN_PROGRESS' });
    
    await new Promise(r => setTimeout(r, 800));
    const pipelineResult = await this.pipelineAgent.runPipeline(patchResult, application);
    appendLogs(pipelineResult.logs);

    this.broadcast('PIPELINE_STEP', { issueId, step: 'CICD_PIPELINE', status: 'COMPLETED', result: pipelineResult });

    // Step 5: Canary Deployment & Hot Reload
    pipelineRun.currentStep = 'CANARY_DEPLOYMENT';
    this.broadcast('PIPELINE_STEP', { issueId, step: 'CANARY_DEPLOYMENT', status: 'IN_PROGRESS' });
    
    await new Promise(r => setTimeout(r, 800));
    const canaryResult = await this.canaryAgent.deploy(patchResult, pipelineResult, application);
    appendLogs(canaryResult.logs);

    this.broadcast('PIPELINE_STEP', { issueId, step: 'CANARY_DEPLOYMENT', status: 'COMPLETED', result: canaryResult });

    // Update Issue & Pipeline final success state
    store.updateIssue(issueId, { status: 'RESOLVED_AND_DEPLOYED', resolvedAt: new Date().toISOString() });
    store.updatePipelineRun(pipelineRun.id, { status: 'SUCCESS', completedAt: new Date().toISOString() });

    this.broadcast('PIPELINE_FINISHED', {
      issueId,
      status: 'SUCCESS',
      applicationId: application.id,
      applicationPort: application.port,
      canaryResult
    });
  }

  async resumeApprovedPipeline(issueId) {
    const issue = store.getIssue(issueId);
    const patch = store.getPatch(issueId);
    const application = store.getApplication(issue.applicationId);
    const pipelineRun = store.getPipelineRun(issueId);

    if (!issue || !patch || !application || !pipelineRun) return;

    store.updatePatch(patch.id, { status: 'APPROVED', approvedAt: new Date().toISOString() });
    store.updateIssue(issueId, { status: 'APPROVED_BY_ADMIN' });

    this.broadcast('ADMIN_APPROVED', { issueId, patchId: patch.id });

    // Continue executing deployment stages
    await this.executeDeploymentPipeline(issueId, patch.patchResult, application, pipelineRun);
  }
}
