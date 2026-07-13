import { useState } from 'react';
import { Layout } from './components/Layout';
import { useGreenhouseSimulator } from './hooks/useGreenhouseSimulator';
import { Alerts } from './pages/Alerts';
import { AiRecognition } from './pages/AiRecognition';
import { Control } from './pages/Control';
import { Dashboard } from './pages/Dashboard';
import { Devices } from './pages/Devices';
import { Environment } from './pages/Environment';
import { ProjectIntro } from './pages/ProjectIntro';
import { PageKey } from './types';

function App() {
  const [page, setPage] = useState<PageKey>('dashboard');
  const simulator = useGreenhouseSimulator();

  return (
    <Layout
      currentPage={page}
      onNavigate={setPage}
      unhandledCount={simulator.stats.unhandled}
      onlineRate={simulator.stats.onlineRate}
    >
      {page === 'dashboard' && (
        <Dashboard
          reading={simulator.reading}
          history={simulator.history}
          deviceStates={simulator.deviceStates}
          stats={simulator.stats}
        />
      )}
      {page === 'environment' && <Environment reading={simulator.reading} />}
      {page === 'control' && (
        <Control
          reading={simulator.reading}
          deviceStates={simulator.deviceStates}
          autoMode={simulator.autoMode}
          setAutoMode={simulator.setAutoMode}
          toggleDevice={simulator.toggleDevice}
        />
      )}
      {page === 'ai' && (
        <AiRecognition
          aiStage={simulator.aiStage}
          aiResult={simulator.aiResult}
          runAiAnalysis={simulator.runAiAnalysis}
        />
      )}
      {page === 'alerts' && <Alerts alarms={simulator.alarms} markAlarmHandled={simulator.markAlarmHandled} />}
      {page === 'devices' && <Devices devices={simulator.devices} toggleDeviceOnline={simulator.toggleDeviceOnline} />}
      {page === 'intro' && <ProjectIntro />}
    </Layout>
  );
}

export default App;
