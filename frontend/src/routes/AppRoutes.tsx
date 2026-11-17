import { Route, Routes } from 'react-router';
import { ChangePasswordPage } from '../features/auth/ChangePasswordPage';
import { LoginPage } from '../features/auth/LoginPage';
import { AttendancePage } from '../features/attendance/AttendancePage';
import { ProgramsPage, SectionsPage, SettingsPage, SubjectsPage, TermsPage } from '../features/catalog/CatalogPages';
import { ClassroomPage } from '../features/classroom/ClassroomPage';
import { EnrollmentsPage } from '../features/enrollments/EnrollmentsPage';
import { SheetPage } from '../features/grading/SheetPage';
import { HistoryPage } from '../features/history/HistoryPage';
import { HomePage } from '../features/home/HomePage';
import { OfferPage } from '../features/offer/OfferPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { TeachingPage } from '../features/teaching/TeachingPage';
import { UsersPage } from '../features/users/UsersPage';
import { AppLayout } from '../shared/layout/AppLayout';
import { RequireAuth } from './RequireAuth';
import { RequireRole } from './RequireRole';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route index element={<HomePage />} />
          <Route path="change-password" element={<ChangePasswordPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route element={<RequireRole roles={['ADMIN']} />}>
            <Route path="users" element={<UsersPage />} />
            <Route path="programs" element={<ProgramsPage />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="sections" element={<SectionsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route element={<RequireRole roles={['STUDENT']} />}>
            <Route path="offer" element={<OfferPage />} />
            <Route path="history" element={<HistoryPage />} />
          </Route>
          <Route element={<RequireRole roles={['TEACHER']} />}>
            <Route path="teaching" element={<TeachingPage />} />
          </Route>
          <Route path="sections/:sectionId" element={<ClassroomPage />} />
          <Route path="sections/:sectionId/sheet" element={<SheetPage />} />
          <Route path="sections/:sectionId/attendance" element={<AttendancePage />} />
          <Route path="sections/:sectionId/enrollments" element={<EnrollmentsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
