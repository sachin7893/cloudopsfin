import { useState } from 'react';
import { FinOpsView } from '@/components/FinOpsView';
import { CloudOpsView } from '@/components/CloudOpsView';
import { Button } from '@/components/ui/button';
import { DollarSign, Cloud } from 'lucide-react';
import { Toaster } from 'sonner';
import './App.css';

type View = 'finops' | 'cloudops';

function App() {
  const [currentView, setCurrentView] = useState<View>('finops');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Cloud Management Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Optimize costs and manage your cloud resources
              </p>
            </div>
            <nav className="flex gap-2">
              <Button
                variant={currentView === 'finops' ? 'default' : 'outline'}
                onClick={() => setCurrentView('finops')}
                className="gap-2"
              >
                <DollarSign className="h-4 w-4" />
                FinOps
              </Button>
              <Button
                variant={currentView === 'cloudops' ? 'default' : 'outline'}
                onClick={() => setCurrentView('cloudops')}
                className="gap-2"
              >
                <Cloud className="h-4 w-4" />
                CloudOps
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 h-[calc(100vh-120px)]">
        {currentView === 'finops' ? <FinOpsView /> : <CloudOpsView />}
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
