import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AdminDashboard from '../../components/AdminDashboard';

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    // Simple authentication check - in production, use proper auth
    const checkAuth = () => {
      const isAdmin = localStorage.getItem('isAdmin') === 'true';
      if (!isAdmin) {
        // For demo purposes, you can set this manually in browser console:
        // localStorage.setItem('isAdmin', 'true')
        router.push('/login');
      } else {
        setIsAuthenticated(true);
      }
    };
    
    checkAuth();
  }, [router]);
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Checking authentication...</div>
      </div>
    );
  }
  
  return <AdminDashboard />;
}