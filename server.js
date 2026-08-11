import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';

import { store } from './platform/services/store.js';
import { MultiAgentOrchestrator } from './platform/agents/orchestrator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// BUGSHIELD SAAS PLATFORM SERVER
// ============================================================================
const platformApp = express();
platformApp.use(cors());
platformApp.use(express.json());

const platformServer = http.createServer(platformApp);
const wss = new WebSocketServer({ server: platformServer });

// Broadcast function for WebSocket clients
const broadcast = (data) => {
  const json = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(json);
  });
};

const orchestrator = new MultiAgentOrchestrator(broadcast);

// Static SDK file serving
platformApp.get('/sdk/bug-shield-sdk.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'sdk/bug-shield-sdk.js'));
});

// Serve SaaS Platform Dashboard UI
platformApp.use(express.static(path.join(__dirname, 'platform/public')));

// Issue Intake REST API (From End Users on Connected Websites)
platformApp.post('/api/v1/issues', async (req, res) => {
  try {
    const { application_id, sdk_key, title, description, page_url, steps_to_reproduce, stack_trace, logs, browser_info } = req.body;

    const application = store.getApplication(application_id || sdk_key);
    if (!application) {
      return res.status(401).json({ success: false, message: 'Invalid or unauthorized application credentials. Please register your website first.' });
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

    console.log(`\n[SaaS Platform] Received End-User Issue #${issueId} from ${application.name}`);

    // Trigger Multi-Agent Pipeline asynchronously
    orchestrator.processIssue(issueId);

    res.json({
      success: true,
      issueId,
      status: 'RECEIVED',
      trackingUrl: `${req.protocol}://${req.get('host')}/#issue-${issueId}`,
      message: 'Issue report accepted. Multi-Agent pipeline initiated.'
    });
  } catch (err) {
    console.error('Error handling issue submission:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

platformApp.get('/api/v1/issues', (req, res) => {
  res.json(store.getIssues());
});

platformApp.post('/api/v1/issues/:id/approve', async (req, res) => {
  const { id } = req.params;
  console.log(`\n[SaaS Platform] Admin Approved High-Risk Patch for Issue #${id}`);
  await orchestrator.resumeApprovedPipeline(id);
  res.json({ success: true, message: 'Admin approval granted. Pipeline resumed.' });
});

platformApp.get('/api/v1/apps', (req, res) => {
  res.json(store.getApplications());
});

platformApp.post('/api/v1/apps', (req, res) => {
  const { name, type, repoUrl, permissions } = req.body;
  const appId = 'APP-' + Math.floor(100 + Math.random() * 900);
  const app = store.addApplication({
    id: appId,
    customerId: 'CUST-001',
    name: name || 'Custom Application',
    type: type || 'Web Service',
    port: 3000,
    repoUrl: repoUrl || 'https://github.com/customer/' + appId.toLowerCase(),
    branch: 'main',
    status: 'Connected',
    sdkKey: `sdk_${appId.toLowerCase()}_live`,
    permissions: permissions || { issueAccess: true, repoAccess: true, deploymentAccess: true },
    jenkinsStatus: 'Connected & Verified',
    dockerStatus: 'Containerized (Active)',
    canaryThreshold: '99.5%'
  });
  res.json({ success: true, app });
});

// ============================================================================
// START SERVER ON PORT 3000
// ============================================================================
const PORT = process.env.PORT || 3000;

platformServer.listen(PORT, () => {
  console.log(`\n================================================================`);
  console.log(`🚀 BUGSHIELD SAAS PLATFORM RUNNING AT: http://localhost:${PORT}`);
  console.log(`   Real-Time Multi-Agent Pipeline & Service Dashboard Active`);
  console.log(`   Ready to connect new websites via /sdk/bug-shield-sdk.js`);
  console.log(`================================================================\n`);
});
