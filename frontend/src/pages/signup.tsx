import { Navigate } from "react-router-dom"

export default function SignupPage() {
  return <Navigate to="/login?tab=sign-up" replace />
}
