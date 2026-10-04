import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlay, FaChalkboardTeacher } from 'react-icons/fa';

export default function Home() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');

  const handleJoin = (e) => {
    e.preventDefault();
    if (pin.trim()) {
      navigate(`/play?pin=${pin}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 flex flex-col items-center justify-center p-4">
      <div className="glass-panel rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 mb-2">QuizApp</h1>
        <p className="text-gray-500 mb-8 font-medium">Seru-seruan bareng teman!</p>

        <form onSubmit={handleJoin} className="space-y-4 mb-8">
          <input
            type="text"
            placeholder="Masukkan Kode PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.toUpperCase())}
            className="w-full px-6 py-4 rounded-xl border-2 border-gray-200 text-center text-2xl font-bold tracking-widest focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all"
            maxLength={6}
          />
          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform transition hover:-translate-y-1 hover:shadow-xl flex items-center justify-center gap-2 text-xl"
          >
            <FaPlay /> MASUK
          </button>
        </form>

        <div className="relative flex items-center py-5">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink-0 mx-4 text-gray-400 font-medium">ATAU</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        <button
          onClick={() => navigate('/host')}
          className="w-full bg-white text-indigo-600 border-2 border-indigo-600 hover:bg-indigo-50 font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-lg"
        >
          <FaChalkboardTeacher /> Bikin Kuis (Host)
        </button>
      </div>
    </div>
  );
}
