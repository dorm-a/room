import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
    const { signInWithGoogle, isLoading, user, isAllowed, signOut } = useAuth();

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50">
                <div className="text-xl font-semibold text-gray-600">Loading...</div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full items-center justify-center bg-gray-50">
            <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-gray-900">생활관 공간관리 시스템</h1>
                    <p className="mt-2 text-sm text-gray-600">운영팀만 접근 가능합니다.</p>
                </div>

                {user && isAllowed === false ? (
                    <div className="space-y-4">
                        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
                            ({user.email}) 계정은 생활관 운영팀에 미등록된 계정입니다. 관리자에게 문의하세요.
                        </div>
                        <button
                            onClick={signOut}
                            className="w-full rounded-md bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300 transition-colors"
                        >
                            Sign out
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={signInWithGoogle}
                        className="flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        구글 계정으로 로그인
                    </button>
                )}
            </div>
        </div>
    );
};
