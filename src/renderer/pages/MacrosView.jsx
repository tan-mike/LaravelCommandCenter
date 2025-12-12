import React, { useState, useEffect } from 'react';

function MacrosView({ currentProject }) {
  const [macros, setMacros] = useState([]);
  const [selectedMacro, setSelectedMacro] = useState(null);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState([]);

  useEffect(() => {
    loadMacros();
  }, []);

  const loadMacros = async () => {
    try {
      const result = await window.api.getMacros();
      if (result.success) {
        setMacros(result.data);
      }
    } catch (error) {
      console.error('Failed to load macros:', error);
    }
  };

  const handleRunMacro = async (macro, dryRun = false) => {
    if (!currentProject) {
      alert('Please select a project first');
      return;
    }

    if (!dryRun && !confirm(`Run macro "${macro.name}"?`)) {
      return;
    }

    setSelectedMacro(macro);
    setRunning(true);
    setOutput([]);

    try {
      const result = await window.api.runMacro(
        macro.id,
        currentProject.path,
        {
          dryRun
          // Note: onProgress removed - can't pass functions through IPC
        }
      );

      if (result.success) {
        if (result.data.dryRun) {
          setOutput([
            { type: 'info', text: '=== DRY RUN ===' },
            { type: 'info', text: 'Commands that would be executed:' },
            ...result.data.commands.map(cmd => ({ type: 'info', text: `  - ${cmd}` }))
          ]);
        } else {
          result.data.results.forEach(r => {
            setOutput(prev => [
              ...prev,
              { type: r.success ? 'success' : 'error', text: `${r.command}: ${r.success ? 'OK' : 'FAILED'}` },
              ...(r.output ? [{ type: 'info', text: r.output }] : []),
              ...(r.error ? [{ type: 'error', text: r.error }] : [])
            ]);
          });
          
          if (result.data.success) {
            setOutput(prev => [...prev, { type: 'success', text: '\n✓ Macro completed successfully' }]);
          } else {
            setOutput(prev => [...prev, { type: 'error', text: '\n✗ Macro completed with errors' }]);
          }
        }
      } else {
        setOutput([{ type: 'error', text: `Error: ${result.error}` }]);
      }
    } catch (error) {
      setOutput([{ type: 'error', text: `Error: ${error.message}` }]);
    }

    setRunning(false);
  };

  if (!currentProject) {
    return (
      <div className="card">
        <h2>Macros</h2>
        <p>Please select a project to use macros.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Available Macros</h2>
        </div>
      </div>

      <div className="grid grid-2">
        {macros.map(macro => (
          <div key={macro.id} className="macro-card">
            <h3>{macro.name}</h3>
            <p>{macro.description}</p>
            <div className="commands">
              {macro.commands.map((cmd, i) => (
                <div key={i}>• {cmd}</div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleRunMacro(macro, true)}
                disabled={running}
                style={{ flex: 1 }}
              >
                Preview
              </button>
              <button
                onClick={() => handleRunMacro(macro, false)}
                disabled={running}
                className="primary"
                style={{ flex: 1 }}
              >
                {running && selectedMacro?.id === macro.id ? 'Running...' : 'Run'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {output.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Output</h2>
            <button onClick={() => setOutput([])}>Clear</button>
          </div>
          <div className="output-console">
            {output.map((line, index) => (
              <div key={index} className={`line ${line.type}`}>
                {line.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MacrosView;
