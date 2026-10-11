import { Component, type ReactNode } from "react";
import { TextButton } from "./Button";
import { Panel, PanelNote } from "./Panel";
import { playSound } from "./sound";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  // The message of the render error that stopped the children, or null while they render
  message: string | null;
}

// React catches render errors only in a class component. Each tab gets its own boundary, so a crash leaves the header,
// the filters and the other tabs working.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { message: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  // Side effects belong here: getDerivedStateFromError can run more than once for one error, this runs once per catch
  componentDidCatch(): void {
    playSound("error");
  }

  render() {
    if (this.state.message === null) return this.props.children;
    return (
      <Panel title="Error">
        <PanelNote>This tab hit an error.</PanelNote>
        <PanelNote>{this.state.message}</PanelNote>
        <TextButton onClick={() => window.location.reload()}>Reload</TextButton>
      </Panel>
    );
  }
}
