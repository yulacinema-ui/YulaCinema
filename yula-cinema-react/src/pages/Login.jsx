import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebase";
import toast from "react-hot-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Введите почту и пароль");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Добро пожаловать!");
      navigate("/rooms");
    } catch {
      toast.error("Неверный email или пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="main-container login-wrapper">
        <div className="login-container">
          <h1>Watch Together</h1>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading}>{loading ? "Вход..." : "Войти"}</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;