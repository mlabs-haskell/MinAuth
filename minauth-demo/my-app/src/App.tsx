import React from 'react';
import logo from './logo.svg';
import './App.css';

import { SimplePreimageProver } from 'minauth-simple-preimage-plugin/prover';

// enum to represent the current state of the compilation work
enum CompilationState {
  // initial state
  None,

  // the prover is being compiled
  Compiling,

  // the prover has been compiled
  Compiled,

  // the prover failed to compile
  Failed
}

function compilationStateToMessage(state: CompilationState): string {
  switch (state) {
    case CompilationState.None:
      return 'No compilation has been started yet.';
    case CompilationState.Compiling:
      return 'The prover is being compiled.';
    case CompilationState.Compiled:
      return 'The prover has been compiled.';
    case CompilationState.Failed:
      return 'The prover failed to compile.';
  }
}

function App() {
  // state to hold the current compilation state
  const [compilationState, setCompilationState] =
    React.useState<CompilationState>(CompilationState.None);
  // state to hold verification key coming from the prover compilation
  const [verificationKey, setVerificationKey] = React.useState<string | null>(
    null
  );

  // one-time compilation of the prover
  React.useEffect(() => {
    // set the compilation state to "compiling"
    console.log('Compiling...');
    setCompilationState(CompilationState.Compiling);
    const prover = SimplePreimageProver.compile().then((vk) => {
      setVerificationKey(vk.verificationKey);

      // compilation is finished
      console.log('Compilation finished.');
      setCompilationState(CompilationState.Compiled);
    });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>{compilationStateToMessage(compilationState)}</p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
