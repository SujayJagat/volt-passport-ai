import { Link, Route, Switch, useLocation } from "wouter";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import { Dashboard } from "@/pages/PortalPages";
import DigitalPassport from "@/pages/DigitalPassport";
import { AnalyzerPage, ExplainabilityPage, SignalPage } from "@/pages/FeaturePages";
import { Register, SignIn } from "@/pages/AuthForms";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

function MainRoutes() {
  return (
    <Switch>
        <Route path="/" component={Home}/>
        <Route path="/sign-in" component={SignIn}/>
        <Route path="/register" component={Register}/>
        
        {/* Protected Private Workspace Routes */}
        <Route path="/dashboard">
          <ProtectedRoute>
            <Dashboard/>
          </ProtectedRoute>
        </Route>
        <Route path="/signal">
          <ProtectedRoute>
            <SignalPage/>
          </ProtectedRoute>
        </Route>
        <Route path="/analyzer">
          <ProtectedRoute>
            <AnalyzerPage/>
          </ProtectedRoute>
        </Route>
        <Route path="/explainability">
          <ProtectedRoute>
            <ExplainabilityPage/>
          </ProtectedRoute>
        </Route>
        <Route path="/passport">
          <ProtectedRoute>
            <DigitalPassport/>
          </ProtectedRoute>
        </Route>

        <Route path="/404" component={NotFound}/>
        <Route component={NotFound}/>
      </Switch>
  );
}

export default function App() {
  return <MainRoutes/>;
}
