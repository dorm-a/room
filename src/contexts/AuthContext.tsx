import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    isAllowed: boolean | null;
    isLoading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    isAllowed: null,
    isLoading: true,
    signInWithGoogle: async () => { },
    signOut: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                checkUserAllowed(session.user.email);
            } else {
                setIsLoading(false);
            }
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                checkUserAllowed(session.user.email);
            } else {
                setIsAllowed(null);
                setIsLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const checkUserAllowed = async (email?: string) => {
        if (!email) {
            setIsAllowed(false);
            setIsLoading(false);
            return;
        }

        try {
            // Check allowed_user table. Assuming it has an 'email' column.
            const { data, error } = await supabase
                .from('allowed_users')
                .select('*')
                .eq('email', email)
                .maybeSingle();

            if (error || !data) {
                console.error("User not found in allowed_user table or error:", error);
                setIsAllowed(false);
            } else {
                setIsAllowed(true);
            }
        } catch (error) {
            console.error("Error checking allowed user:", error);
            setIsAllowed(false);
        } finally {
            setIsLoading(false);
        }
    };

    const signInWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            }
        });
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ session, user, isAllowed, isLoading, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
