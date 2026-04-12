import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebase";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      toast.success("Добро пожаловать!");
      navigate("/rooms");
    } catch (err) {
      console.error(err);
      toast.error("Неверный email или пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="login-page"
    >
      <div className="main-container login-wrapper">
        <div className="login-container">
          <h1>Watch Together</h1>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="input-group">
              <input
                type="email"
                placeholder="Email"
                {...register("email", { required: "Email обязателен" })}
                autoComplete="off"
              />
              {errors.email && (
                <p className="error-text">{errors.email.message}</p>
              )}
              <input
                type="password"
                placeholder="Password"
                {...register("password", { required: "Пароль обязателен" })}
              />
              {errors.password && (
                <p className="error-text">{errors.password.message}</p>
              )}
            </div>
            <button type="submit" disabled={loading}>
              {loading ? "Вход..." : "Войти"}
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
};

export default Login;