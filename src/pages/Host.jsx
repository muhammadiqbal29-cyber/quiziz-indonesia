import React, { useState, useEffect, useRef } from 'react';
import { Peer } from 'peerjs';
import questions from '../data/questions.json';
import Papa from 'papaparse';

export default function Host() {
  const [peerId, setPeerId] = useState('');
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState('LOBBY'); // LOBBY, QUESTION, ANSWER_REVIEW, LEADERBOARD, END
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes per question
  
  const peerRef = useRef(null);
  const connectionsRef = useRef({}); // { peerId: DataConnection }
  const timerRef = useRef(null);
  const currentIndexRef = useRef(0);
  const timeLeftRef = useRef(120);
  const playersRef = useRef([]);

  // Sync state to refs for event listeners
  useEffect(() => { currentIndexRef.current = currentQuestionIndex; }, [currentQuestionIndex]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
  useEffect(() => { playersRef.current = players; }, [players]);

  useEffect(() => {
    // Generate a simple 4 letter ID
    const id = Math.random().toString(36).substring(2, 6).toUpperCase();
    const peer = new Peer(id);
    
    peer.on('open', (id) => {
      setPeerId(id);
    });

    peer.on('connection', (conn) => {
      conn.on('data', (data) => {
        if (data.type === 'JOIN') {
          setPlayers((prev) => {
            if (prev.find(p => p.id === conn.peer || p.name === data.name)) {
              return prev; 
            }
            return [...prev, { id: conn.peer, name: data.name, score: 0, currentAnswer: null }];
          });
          connectionsRef.current[conn.peer] = conn;
          conn.send({ type: 'STATE_UPDATE', state: 'LOBBY' });
        } else if (data.type === 'ANSWER') {
          handlePlayerAnswer(conn.peer, data.answer);
        }
      });
      
      conn.on('close', () => {
        setPlayers((prev) => prev.filter(p => p.id !== conn.peer));
        delete connectionsRef.current[conn.peer];
      });
    });

    peerRef.current = peer;

    return () => {
      peer.destroy();
      if(timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const broadcast = (data) => {
    Object.values(connectionsRef.current).forEach(conn => {
      conn.send(data);
    });
  };

  const startGame = () => {
    setGameState('QUESTION');
    setCurrentQuestionIndex(0);
    startQuestion(0);
  };

  const startQuestion = (index) => {
    setPlayers(prev => prev.map(p => ({ ...p, currentAnswer: null })));
    setTimeLeft(120);
    timeLeftRef.current = 120;
    
    const q = questions[index];
    broadcast({ 
      type: 'STATE_UPDATE', 
      state: 'QUESTION', 
      question: { id: q.id, text: q.text, options: q.options, type: q.type },
      timeLeft: 120
    });
    
    if(timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimeUp(currentIndexRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handlePlayerAnswer = (playerId, answerIndex) => {
    setPlayers(prev => {
      const newPlayers = prev.map(p => {
        if (p.id === playerId) {
          return { ...p, currentAnswer: answerIndex };
        }
        return p;
      });
      
      // Check if all answered
      const allAnswered = newPlayers.every(p => p.currentAnswer !== null);
      if (allAnswered && timerRef.current) {
        clearInterval(timerRef.current);
        // We use setTimeout to let state update first
        setTimeout(() => handleTimeUp(currentIndexRef.current, newPlayers), 100);
      }
      return newPlayers;
    });
  };

  const forceTimeUp = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    handleTimeUp(currentQuestionIndex, playersRef.current);
  };

  const handleTimeUp = (index, currentPlayers = null) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const q = questions[index];
    const playersToUse = currentPlayers || playersRef.current;
    
    // Calculate scores
    const updatedPlayers = playersToUse.map(p => {
      const isCorrect = p.currentAnswer === q.correctAnswer;
      return {
        ...p,
        score: isCorrect ? p.score + 100 + Math.floor(timeLeftRef.current) : p.score,
        lastCorrect: isCorrect
      };
    });
    setPlayers(updatedPlayers);
    setGameState('ANSWER_REVIEW');

    // Send result to each player individually
    Object.values(connectionsRef.current).forEach(conn => {
      const player = updatedPlayers.find(p => p.id === conn.peer);
      conn.send({
        type: 'STATE_UPDATE',
        state: 'ANSWER_RESULT',
        correctAnswer: q.correctAnswer,
        isCorrect: player?.lastCorrect || false,
        score: player?.score || 0
      });
    });
  };

  const showLeaderboard = () => {
    setGameState('LEADERBOARD');
  };

  const nextQuestion = () => {
    if (currentQuestionIndex + 1 < questions.length) {
      setGameState('QUESTION');
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      startQuestion(currentQuestionIndex + 1);
    } else {
      setGameState('END');
      broadcast({ type: 'STATE_UPDATE', state: 'END', players: players.sort((a,b)=>b.score - a.score) });
    }
  };

  const downloadResults = () => {
    const sorted = [...players].sort((a,b) => b.score - a.score);
    const data = sorted.map((p, i) => ({
      Peringkat: i + 1,
      Nama: p.name,
      Skor: p.score
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'hasil_kuis.csv';
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {gameState === 'LOBBY' && (
          <div className="bg-white rounded-3xl p-10 shadow-xl text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Bergabunglah di QuizApp!</h2>
            <p className="text-xl text-gray-600 mb-8">Buka aplikasi dan masukkan PIN:</p>
            <div className="bg-indigo-100 border-4 border-indigo-500 rounded-2xl p-6 mb-8 inline-block">
              <span className="text-7xl font-black text-indigo-700 tracking-widest">{peerId || '...'}</span>
            </div>
            
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl mb-6">
              <span className="font-bold text-lg text-gray-700">{players.length} Pemain Bergabung</span>
              <button 
                onClick={startGame}
                disabled={players.length === 0}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold py-3 px-8 rounded-full shadow-lg transition"
              >
                MULAI KUIS
              </button>
            </div>
            
            <div className="flex flex-wrap gap-4 justify-center">
              {players.map(p => (
                <div key={p.id} className="bg-indigo-500 text-white px-6 py-2 rounded-full font-bold shadow-md animate-bounce">
                  {p.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {gameState === 'QUESTION' && (
          <div className="bg-white rounded-3xl p-10 shadow-xl text-center">
            <div className="flex justify-between items-center mb-6">
              <span className="text-gray-500 font-bold">Soal {currentQuestionIndex + 1} / {questions.length}</span>
              <span className="text-3xl font-black text-red-500">{timeLeft}s</span>
            </div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-8 text-left whitespace-pre-wrap">{questions[currentQuestionIndex].text}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {questions[currentQuestionIndex].options.map((opt, i) => (
                <div key={i} className="bg-blue-100 border-2 border-blue-400 p-6 rounded-2xl text-left text-lg font-medium text-blue-900">
                  {opt}
                </div>
              ))}
            </div>
            
            <div className="mt-8 flex flex-col items-center justify-center gap-4">
              <div className="text-gray-500 font-bold text-lg">
                Menunggu jawaban: {players.filter(p => p.currentAnswer === null).length} pemain lagi...
              </div>
              <button 
                onClick={forceTimeUp}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-full shadow-md transition"
              >
                Hentikan Waktu & Lihat Jawaban
              </button>
            </div>
          </div>
        )}

        {gameState === 'ANSWER_REVIEW' && (
          <div className="bg-white rounded-3xl p-10 shadow-xl text-center border-4 border-indigo-200">
            <h2 className="text-3xl font-black text-indigo-700 mb-6">Waktu Habis! Ini Jawaban yang Benar:</h2>
            <h3 className="text-xl font-semibold text-gray-700 mb-8 text-left whitespace-pre-wrap border-b pb-4">{questions[currentQuestionIndex].text}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {questions[currentQuestionIndex].options.map((opt, i) => {
                const isCorrect = i === questions[currentQuestionIndex].correctAnswer;
                return (
                  <div key={i} className={`p-6 rounded-2xl text-left text-lg font-bold ${isCorrect ? 'bg-green-100 border-4 border-green-500 text-green-900 shadow-lg' : 'bg-gray-100 border-2 border-gray-300 text-gray-500 opacity-50'}`}>
                    {isCorrect ? '✅ ' : '❌ '} {opt}
                  </div>
                );
              })}
            </div>
            
            <button 
              onClick={showLeaderboard}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-10 rounded-full shadow-lg transition text-xl w-full"
            >
              Lanjut ke Papan Peringkat
            </button>
          </div>
        )}

        {gameState === 'LEADERBOARD' && (
          <div className="bg-white rounded-3xl p-10 shadow-xl text-center">
            <h2 className="text-4xl font-black text-indigo-700 mb-8">Papan Peringkat Sementara</h2>
            <div className="space-y-4 max-w-lg mx-auto mb-10">
              {[...players].sort((a,b) => b.score - a.score).map((p, i) => (
                <div key={p.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border-l-8 border-indigo-500 shadow-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-black text-gray-400">#{i+1}</span>
                    <span className="text-xl font-bold text-gray-800">{p.name}</span>
                  </div>
                  <span className="text-2xl font-bold text-indigo-600">{p.score}</span>
                </div>
              ))}
            </div>
            <button 
              onClick={nextQuestion}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-10 rounded-full shadow-lg transition text-xl"
            >
              Lanjut ke Soal Berikutnya
            </button>
          </div>
        )}

        {gameState === 'END' && (
          <div className="bg-white rounded-3xl p-10 shadow-xl text-center">
            <h1 className="text-5xl font-black text-green-500 mb-4">Kuis Selesai!</h1>
            <p className="text-xl text-gray-600 mb-10">Selamat kepada para pemenang!</p>
            
            <div className="flex justify-center items-end gap-4 mb-12 h-64">
              {/* Podium */}
              {(() => {
                const sorted = [...players].sort((a,b) => b.score - a.score);
                const getPlayer = (idx) => sorted[idx] || null;
                return (
                  <>
                    {/* Juara 2 */}
                    {getPlayer(1) && (
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-xl mb-2 truncate w-24">{getPlayer(1).name}</span>
                        <div className="bg-gray-300 w-24 h-32 rounded-t-lg flex justify-center items-start pt-2 font-black text-3xl text-gray-600">2</div>
                      </div>
                    )}
                    {/* Juara 1 */}
                    {getPlayer(0) && (
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-2xl mb-2 text-yellow-500 truncate w-32">{getPlayer(0).name}</span>
                        <div className="bg-yellow-400 w-32 h-48 rounded-t-lg flex justify-center items-start pt-2 font-black text-5xl text-yellow-700">1</div>
                      </div>
                    )}
                    {/* Juara 3 */}
                    {getPlayer(2) && (
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-xl mb-2 text-orange-400 truncate w-24">{getPlayer(2).name}</span>
                        <div className="bg-orange-300 w-24 h-24 rounded-t-lg flex justify-center items-start pt-2 font-black text-3xl text-orange-800">3</div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            <button 
              onClick={downloadResults}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-10 rounded-full shadow-lg transition text-xl flex items-center justify-center gap-3 mx-auto"
            >
              Download Hasil Kuis (CSV)
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
