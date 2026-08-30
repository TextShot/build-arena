import { StrictMode, useEffect, type ComponentType } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";

const rootElement = document.getElementById("root");
const startupRecovery = document.getElementById("startup-recovery");

if (!rootElement) {
  const error = new Error("The application root element is missing.");
  console.error("Build Arena startup failed.", error);
  startupRecovery?.setAttribute("data-visible", "true");
  throw error;
}
const appRootElement: HTMLElement = rootElement;

function MountedApp({ App }: Readonly<{ App: ComponentType }>) {
  useEffect(() => {
    document.documentElement.dataset.appReady = "true";
    startupRecovery?.setAttribute("hidden", "");
  }, []);
  return <App />;
}

function reportStartupFailure(error: unknown, context?: unknown) {
  console.error("Build Arena startup failed.", error, context);
  startupRecovery?.removeAttribute("hidden");
  startupRecovery?.setAttribute("data-visible", "true");
}

async function bootstrap() {
  try {
    const { App } = await import("./app/App");
    const root = createRoot(appRootElement, {
      onRecoverableError: (error, errorInfo) => {
        console.error("Build Arena recovered from a render error.", error, errorInfo);
      },
      onUncaughtError: (error, errorInfo) => reportStartupFailure(error, errorInfo),
    });
    root.render(
      <StrictMode>
        <MountedApp App={App} />
      </StrictMode>,
    );
  } catch (error) {
    reportStartupFailure(error);
  }
}

void bootstrap();
