import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(email, password);
    navigate('/rooms');
  };

  return (
    <div className="min-h-screen flex items-center justify-center login-page">
      <div className="login-container w-full max-w-[340px] p-10 text-center animate-fade-in">
        <h1 className="text-3xl font-bold mb-8 tracking-tight">YulaCinema</h1>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-3 mb-5">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 bg-apple-input border border-transparent rounded-xl px-4 text-white placeholder:text-apple-secondary focus:border-apple-accent focus:bg-[rgba(58,58,60,0.8)] outline-none transition-all"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 bg-apple-input border border-transparent rounded-xl px-4 text-white placeholder:text-apple-secondary focus:border-apple-accent focus:bg-[rgba(58,58,60,0.8)] outline-none transition-all"
              required
            />
          </div>
          <button type="submit" className="w-full bg-apple-accent text-white py-3 rounded-xl font-semibold active:opacity-70 transition-opacity">
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;