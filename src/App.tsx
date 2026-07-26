import { lazy, Suspense, useState } from 'react';
import { Layout } from './components/Layout';
import { useGreenhouseSimulator } from './hooks/useGreenhouseSimulator';
import { PageKey } from './types';

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Environment = lazy(() => import('./pages/Environment').then((module) => ({ default: module.Environment })));
const Control = lazy(() => import('./pages/Control').then((module) => ({ default: module.Control })));
const AiRecognition = lazy(() => import('./pages/AiRecognition').then((module) => ({ default: module.AiRecognition })));
const Alerts = lazy(() => import('./pages/Alerts').then((module) => ({ default: module.Alerts })));
const Devices = lazy(() => import('./pages/Devices').then((module) => ({ default: module.Devices })));
const ProjectIntro = lazy(() => import('./pages/ProjectIntro').then((module) => ({ default: module.ProjectIntro })));

function App() {
  const [page, setPage] = useState<PageKey>('dashboard');
  const simulator = useGreenhouseSimulator();

  return (
    <Layout
      currentPage={page}
      onNavigate={setPage}
      unresolvedCount={simulator.stats.unresolved}
      onlineRate={simulator.stats.onlineRate}
      lastUpdatedAt={simulator.lastUpdatedAt}
      persistenceError={simulator.persistenceError}
      actionMessage={simulator.actionMessage}
      onReset={simulator.resetDemoData}
    >
      <Suspense fallback={<div className="panel loading-panel">页面正在加载…</div>}>
        {page === 'dashboard' && (
          <Dashboard
            reading={simulator.reading}
            history={simulator.history}
            sensors={simulator.sensors}
            actuators={simulator.actuators}
            stats={simulator.stats}
            presentation={simulator.presentation}
            onSelectPresentationScenario={simulator.selectPresentationScenario}
            onPausePresentation={simulator.pausePresentation}
            onResumePresentation={simulator.resumePresentation}
            onStepPresentation={simulator.stepPresentation}
            onResetPresentation={simulator.resetPresentationScenario}
            onRegeneratePresentationSeed={simulator.regeneratePresentationSeed}
            onCopyPresentationSeed={simulator.copyPresentationSeed}
            onExportSnapshot={simulator.exportSnapshot}
            onImportSnapshot={simulator.importSnapshot}
            onExportOperationLog={simulator.exportOperationLog}
            onDebateReset={simulator.debateReset}
            isDebateResetting={simulator.isDebateResetting}
          />
        )}
        {page === 'environment' && <Environment reading={simulator.reading} sensors={simulator.sensors} />}
        {page === 'control' && (
          <Control
            reading={simulator.reading}
            actuators={simulator.actuators}
            controlMode={simulator.controlMode}
            setControlMode={simulator.setControlMode}
            toggleManualTarget={simulator.toggleManualTarget}
          />
        )}
        {page === 'ai' && (
          <AiRecognition
            aiStage={simulator.aiStage}
            aiResult={simulator.aiResult}
            aiError={simulator.aiError}
            scenario={simulator.demoScenario}
            setScenario={simulator.setDemoScenario}
            runRecognition={simulator.runRecognition}
          />
        )}
        {page === 'alerts' && <Alerts alarms={simulator.alarms} acknowledgeAlarm={simulator.acknowledgeAlarm} presentation={simulator.presentation} />}
        {page === 'devices' && (
          <Devices devices={simulator.devices} actuators={simulator.actuators} toggleDeviceOnline={simulator.toggleDeviceOnline} runtime={simulator.runtime} />
        )}
        {page === 'intro' && <ProjectIntro />}
      </Suspense>
    </Layout>
  );
}

export default App;
