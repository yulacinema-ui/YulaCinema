import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../services/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, set, onDisconnect, onValue } from "firebase/database";
import toast from "react-hot-toast";

const AuthContext = createContext();

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Статус "онлайн" с авто-удалением при отключении
        const userStatusRef = ref(db, `status/${currentUser.uid}`);
        const connectedRef = ref(db, ".info/connected");
        const unsubConnected = onValue(connectedRef, (snap) => {
          if (snap.val() === true) {
            onDisconnect(userStatusRef).remove();
            set(userStatusRef, { email: currentUser.email, online: true });
          }
        });
        return () => unsubConnected();
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const logout = async () => {
    await signOut(auth);
    toast.success("Вы вышли из аккаунта");
  };

  const value = { user, loading, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};