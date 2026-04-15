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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        const statusRef = ref(db, `status/${currentUser.uid}`);
        const connectedRef = ref(db, ".info/connected");
        onValue(connectedRef, (snap) => {
          if (snap.val() === true) {
            onDisconnect(statusRef).remove();
            set(statusRef, { email: currentUser.email, online: true });
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
    toast.success("Вы вышли");
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};