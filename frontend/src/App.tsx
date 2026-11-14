import { BrowserRouter } from 'react-router';
import { AppRoutes } from './routes/AppRoutes';
import { SessionProvider } from './shared/session';

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </BrowserRouter>
  );
}
