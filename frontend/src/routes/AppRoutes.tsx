import { Route, Routes } from 'react-router';
import { HomePage } from '../features/home/HomePage';
import { LoginPage } from '../features/login/LoginPage';
import { AppLayout } from '../shared/layout/AppLayout';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
      </Route>
    </Routes>
  );
}
