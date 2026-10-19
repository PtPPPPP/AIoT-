import { lazy, Suspense, useState } from 'react';
import { Layout } from './components/Layout';
import { useGreenhouseSimulator } from './hooks/useGreenhouseSimulator';
import { DeviceStateKey, PageKey } from './types';

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Environment = lazy(() => import('./pages/Environment').then((module) => ({ default: module.Environment })));
const Control = lazy(() => import('./pages/Control').then((module) => ({ default: module.Control })));
const AiRecognition = lazy(() => import('./pages/AiRecognition').then((module) => ({ default: module.AiRecognition })));
const Alerts = lazy(() => import('./pages/Alerts').then((module) => ({ default: module.Alerts })));
const Devices = lazy(() => import('./pages/Devices').then((module) => ({ default: module.Devices })));
const ProjectIntro = lazy(() => import('./pages/ProjectIntro').then((module) => ({ default: module.ProjectIntro })));

function App() {
  const [page, setPage] = useState<PageKey>('dashboard');
  const [focus, setFocus] = useState<string | undefined>();
  const navigate = (next: PageKey, id?: string) => { setFocus(id); setPage(next); };
  const simulator = useGreenhouseSimulator();

  return (
    <Layout
      currentPage={page}
      onNavigate={navigate}
      unresolvedCount={simulator.stats.unresolved}
      runtime={simulator.runtime}
      sensors={simulator.sensors}
      persistenceError={simulator.persistenceError}
      actionMessage={simulator.actionMessage}
      onReset={simulator.resetDemoData}
    >
      <Suspense fallback={<div className="panel loading-panel">页面正在加载…</div>}>
        {page === 'dashboard' && <Dashboard model={simulator} onNavigate={navigate} />}
        {page === 'environment' && <Environment reading={simulator.reading} sensors={simulator.sensors} runtime={simulator.runtime} />}
        {page === 'control' && (
          <Control
            devices={simulator.devices}
            sensors={simulator.sensors}
            controlRecords={simulator.controlRecords}
            alarms={simulator.alarms}
            history={simulator.history}
            focusDevice={focus?.split(':')[0] as DeviceStateKey | undefined}
            focusRecords={focus?.endsWith(':records')}
            armControl={simulator.armControl}
            reading={simulator.reading}
            actuators={simulator.actuators}
            controlMode={simulator.controlMode}
            setControlMode={simulator.setControlMode}
            toggleManualTarget={simulator.toggleManualTarget}
            runtime={simulator.runtime}
          />
        )}
        {page === 'ai' && (
          <AiRecognition
            reviews={simulator.aiReviews}
            onReview={simulator.reviewAi}
            aiStage={simulator.aiStage}
            aiResult={simulator.aiResult}
            aiError={simulator.aiError}
            scenario={simulator.demoScenario}
            runtime={simulator.runtime}
            setScenario={simulator.setDemoScenario}
            runRecognition={simulator.runRecognition}
          />
        )}
        {page === 'alerts' && <Alerts alarms={simulator.alarms} acknowledgeAlarm={simulator.acknowledgeAlarm} presentation={simulator.presentation} devices={simulator.devices} actuators={simulator.actuators} records={simulator.controlRecords} handleAlarm={simulator.handleAlarm} selectedId={focus} onNavigate={navigate} />}
        {page === 'devices' && (
          <Devices devices={simulator.devices} sensors={simulator.sensors} focus={focus} actuators={simulator.actuators} toggleDeviceOnline={simulator.toggleDeviceOnline} runtime={simulator.runtime} />
        )}
        {page === 'intro' && <ProjectIntro runtime={simulator.runtime} />}
      </Suspense>
    </Layout>
  );
}

export default App;
