import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { store } from '../platform/services/store.js';
import { MultiAgentOrchestrator } from '../platform/agents/orchestrator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

const orchestrator = new MultiAgentOrchestrator(null);

// Static SDK file serving
app.get('/sdk/bug-shield-sdk.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../sdk/bug-shield-sdk.js'));
});

// Serve SaaS Platform Dashboard Static Files
app.use(express.static(path.join(__dirname, '../platform/public')));

// Issue Intake REST API
app.post('/api/v1/issues', async (req, res) => {
  try {
    const { application_id, sdk_key, title, description, page_url, steps_to_reproduce, stack_trace, logs, browser_info } = req.body;

    const application = store.getApplication(application_id || sdk_key);
    if (!application) {
      return res.status(401).json({ success: false, message: 'Invalid or unauthorized application credentials' });
    }

    const issueId = 'ISSUE-' + Math.floor(1000 + Math.random() * 9000);
    const issue = store.addIssue({
      id: issueId,
      applicationId: application.id,
      title: title || 'Unspecified Error',
      description: description || '',
      pageUrl: page_url || '/',
      stepsToReproduce: steps_to_reproduce || '',
      stackTrace: stack_trace || '',
      logs: logs || [],
      browserInfo: browser_info || {},
      status: 'RECEIVED',
      reportedAt: new Date().toISOString()
    });

    // Run orchestrator pipeline
    orchestrator.processIssue(issueId);

    res.json({
      success: true,
      issueId,
      status: 'RECEIVED',
      message: 'Issue report accepted. Multi-Agent pipeline initiated.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/v1/issues', (req, res) => {
  res.json(store.getIssues());
});

app.post('/api/v1/issues/:id/approve', async (req, res) => {
  const { id } = req.params;
  await orchestrator.resumeApprovedPipeline(id);
  res.json({ success: true, message: 'Admin approval granted. Pipeline resumed.' });
});

app.get('/api/v1/apps', (req, res) => {
  res.json(store.getApplications());
});

app.post('/api/v1/apps', (req, res) => {
  const { name, type, repoUrl, permissions } = req.body;
  const appId = 'APP-' + Math.floor(100 + Math.random() * 900);
  const newApp = store.addApplication({
    id: appId,
    customerId: 'CUST-001',
    name: name || 'Custom Application',
    type: type || 'Web Service',
    port: 3003,
    repoUrl: repoUrl || 'https://github.com/customer/' + appId.toLowerCase(),
    branch: 'main',
    status: 'Connected',
    sdkKey: `sdk_${appId.toLowerCase()}_live`,
    permissions: permissions || { issueAccess: true, repoAccess: true, deploymentAccess: true },
    jenkinsStatus: 'Connected & Verified',
    dockerStatus: 'Containerized (Active)',
    canaryThreshold: '99.5%'
  });
  res.json({ success: true, app: newApp });
});

// Serve Dashboard Index HTML on root path
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../platform/public/index.html'));
});

export default app;
