import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AuthProvider } from "./contexts/AuthContext";
import { AuthorAuthProvider } from "./contexts/AuthorAuthContext";
import { AuthorProtectedRoute } from "./components/author/AuthorProtectedRoute";
import { AuthorLayout } from "./components/author/AuthorLayout";
import { AuthorLoginPage } from "./pages/author/AuthorLoginPage";
import { AuthorRegisterPage } from "./pages/author/AuthorRegisterPage";
import { AuthorDashboardPage } from "./pages/author/AuthorDashboardPage";
import { AuthorSubmitPage } from "./pages/author/AuthorSubmitPage";
import { AuthorSubmissionDetailPage } from "./pages/author/AuthorSubmissionDetailPage";
import { AuthorEditSubmissionPage } from "./pages/author/AuthorEditSubmissionPage";
import { AuthorProfilePage } from "./pages/author/AuthorProfilePage";
import { AppProvider } from "./contexts/AppContext";
import { AdminLoginPage } from "./pages/admin/AdminLoginPage";
import { ForgotPasswordPage } from "./pages/admin/ForgotPasswordPage";
import { ProductionPipelinePage } from "./pages/admin/ProductionPipelinePage";
import { DashboardPage } from "./pages/admin/DashboardPage";
import { SubmissionsPage } from "./pages/admin/SubmissionsPage";
import { SubmissionDetailPage } from "./pages/admin/SubmissionDetailPage";
import { JournalsManagePage } from "./pages/admin/JournalsManagePage";
import { PaymentsPage } from "./pages/admin/PaymentsPage";
import { InvoiceViewPage } from "./pages/admin/InvoiceViewPage";
import { DOIManagePage } from "./pages/admin/DOIManagePage";
import { PublishArticlePage } from "./pages/admin/PublishArticlePage";
import { VolumesPage } from "./pages/admin/VolumesPage";
import { ReportsPage } from "./pages/admin/ReportsPage";
import { RoleManagePage } from "./pages/admin/RoleManagePage";
import { UserManagePage } from "./pages/admin/UserManagePage";
import { SettingsPage } from "./pages/admin/SettingsPage";
import { ContactQueriesPage } from "./pages/admin/ContactQueriesPage";
import { MediaPage } from "./pages/admin/MediaPage";
import { SubmitPage } from "./pages/public/SubmitPage";
import { SubmissionSuccessPage } from "./pages/public/SubmissionSuccessPage";
import { TrackSubmissionPage } from "./pages/public/TrackSubmissionPage";
import { JournalsPage } from "./pages/public/JournalsPage";
import { JournalDetailPage } from "./pages/public/JournalDetailPage";
import { ArchivePage } from "./pages/public/ArchivePage";
import { ArticlePage } from "./pages/public/ArticlePage";
import { PaymentPage } from "./pages/public/PaymentPage";

const App = () => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <AuthProvider>
      <AuthorAuthProvider>
      <AppProvider>
        <Routes>
          <Route path="/" element={<AdminLoginPage />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/submit/success" element={<SubmissionSuccessPage />} />
          <Route path="/journals" element={<JournalsPage />} />
          <Route path="/track/:id" element={<TrackSubmissionPage />} />
          <Route path="/pay/:id" element={<PaymentPage />} />
          <Route path="/journals/:code" element={<JournalDetailPage />} />
          <Route path="/journals/:code/archive" element={<ArchivePage />} />
          <Route path="/journals/:code/archive/:volumeIssueSlug" element={<ArchivePage />} />
          <Route
            path="/journals/:journalSlug/archive/:volumeIssueSlug/:articleSlug"
            element={<ArticlePage />}
          />
          <Route path="/articles/:id" element={<Navigate to="/journals" replace />} />

          <Route path="/author/login" element={<AuthorLoginPage />} />
          <Route path="/author/register" element={<AuthorRegisterPage />} />
          <Route
            path="/author/*"
            element={
              <AuthorProtectedRoute>
                <AuthorLayout />
              </AuthorProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AuthorDashboardPage />} />
            <Route path="submit" element={<AuthorSubmitPage />} />
            <Route path="submissions/:id/edit" element={<AuthorEditSubmissionPage />} />
            <Route path="submissions/:id" element={<AuthorSubmissionDetailPage />} />
            <Route path="invoices/:id" element={<InvoiceViewPage />} />
            <Route path="profile" element={<AuthorProfilePage />} />
          </Route>

          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/admin" element={<Navigate to="/admin/login" replace />} />

          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route
              path="dashboard"
              element={
                <ProtectedRoute permission="dashboard:read">
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            <Route path="submissions" element={<Navigate to="submissions/new" replace />} />
            {(["new", "under-review", "accepted", "rejected"] as const).map((seg) => (
              <Route
                key={seg}
                path={`submissions/${seg}`}
                element={
                  <ProtectedRoute permission="submissions:read">
                    <SubmissionsPage />
                  </ProtectedRoute>
                }
              />
            ))}
            <Route
              path="submissions/:id"
              element={
                <ProtectedRoute permission="submissions:read">
                  <SubmissionDetailPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="journals"
              element={
                <ProtectedRoute permission="journals:read">
                  <JournalsManagePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="payments/pending"
              element={
                <ProtectedRoute permission="payments:read">
                  <PaymentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="payments/completed"
              element={
                <ProtectedRoute permission="payments:read">
                  <PaymentsPage />
                </ProtectedRoute>
              }
            />
            <Route path="payments" element={<Navigate to="payments/pending" replace />} />

            <Route
              path="invoices/:id"
              element={
                <ProtectedRoute permission="invoices:read">
                  <InvoiceViewPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="doi/pending"
              element={
                <ProtectedRoute permission="doi:read">
                  <DOIManagePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="doi/minted"
              element={
                <ProtectedRoute permission="doi:read">
                  <DOIManagePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="doi/no-doi"
              element={
                <ProtectedRoute permission="doi:read">
                  <DOIManagePage />
                </ProtectedRoute>
              }
            />
            <Route path="doi" element={<Navigate to="doi/pending" replace />} />

            <Route
              path="production/publish"
              element={
                <ProtectedRoute permission="publish:read">
                  <PublishArticlePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="production/volumes"
              element={
                <ProtectedRoute permission="publish:write">
                  <VolumesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="production/preparation"
              element={
                <ProtectedRoute permission="publish:read">
                  <ProductionPipelinePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="production/upload"
              element={
                <ProtectedRoute permission="publish:read">
                  <ProductionPipelinePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="production/ready-published"
              element={
                <ProtectedRoute permission="publish:read">
                  <ProductionPipelinePage />
                </ProtectedRoute>
              }
            />

            <Route path="archives" element={<Navigate to="/journals" replace />} />

            <Route
              path="media"
              element={
                <ProtectedRoute superAdminOnly>
                  <MediaPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="reports"
              element={
                <ProtectedRoute permission="reports:read">
                  <ReportsPage />
                </ProtectedRoute>
              }
            />

            <Route path="publish" element={<Navigate to="production/publish" replace />} />

            <Route
              path="system/roles"
              element={
                <ProtectedRoute superAdminOnly>
                  <RoleManagePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="system/users"
              element={
                <ProtectedRoute superAdminOnly>
                  <UserManagePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="system/settings"
              element={
                <ProtectedRoute superAdminOnly>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="contact-queries" element={
              <ProtectedRoute permission="submissions:read">
                <ContactQueriesPage />
              </ProtectedRoute>
            } />
            <Route path="roles" element={<Navigate to="system/roles" replace />} />
            <Route path="users" element={<Navigate to="system/users" replace />} />
            <Route path="settings" element={<Navigate to="system/settings" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/admin/login" replace />} />
        </Routes>
      </AppProvider>
      </AuthorAuthProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
