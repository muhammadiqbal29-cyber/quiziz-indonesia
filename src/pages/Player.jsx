import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Peer } from 'peerjs';
import { playCorrectSound, playWrongSound } from '../utils/sound';

const colors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];

const correctGifs = [
  'https://media.tenor.com/J7tIovtH1z0AAAAi/happy-cat-jumping.gif', // Happy cat
  'https://media.tenor.com/T_tQkPxyfTMAAAAi/minions-cheer.gif', // Minions
  'https://media.tenor.com/aC-5iR3Qo88AAAAi/spongebob-squarepants.gif', // Spongebob
  'https://media.tenor.com/2cPx1iQJ28sAAAAi/thumbs-up-kid.gif', // Thumbs up kid
  'https://media.tenor.com/5lF8x5yY93AAAAAi/nice-michael-rosen.gif' // Nice Michael Rosen
];

const wrongGifs = [
  'https://media.tenor.com/vHq4wA9NItAAAAAi/sad-cat.gif', // Sad cat
  'https://media.tenor.com/eDTRHroN6aYAAAAi/confused-john-travolta.gif', // Confused Travolta
  'https://media.tenor.com/k4_hF8qVp5oAAAAi/facepalm-picard.gif', // Facepalm
  'https://media.tenor.com/OcbE9a5W5S8AAAAi/spongebob-sad.gif', // Spongebob sad
  'https://media.tenor.com/n14aTls34o0AAAAi/monkey-disappointed.gif' // Disappointed monkey
];

export default function Player() {
  const [searchParams] = useSearchParams();
  const pin = searchParams.get('pin');
  
  const [name, setName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [gameState, setGameState] = useState('LOBBY'); // LOBBY, QUESTION, ANSWER_RESULT, LEADERBOARD, END
  const [question, setQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [myAnswer, setMyAnswer] = useState(null);
  
  // Result state
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentGif, setCurrentGif] = useState('');
  
  const connRef = useRef(null);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const peer = new Peer();
    
    peer.on('open', () => {
      const conn = peer.connect(pin);
      
      conn.on('open', () => {
        setIsJoined(true);
        connRef.current = conn;
        conn.send({ type: 'JOIN', name });
      });

      conn.on('data', (data) => {
        if (data.type === 'STATE_UPDATE') {
          setGameState(data.state);
          if (data.state === 'QUESTION') {
            setQuestion(data.question);
            setTimeLeft(data.timeLeft);
            setMyAnswer(null);
          } else if (data.state === 'ANSWER_RESULT') {
            setIsCorrect(data.isCorrect);
            setScore(data.score);
            
            // Pilih GIF secara acak berdasarkan hasil
            if (data.isCorrect) {
              playCorrectSound();
              setCurrentGif(correctGifs[Math.floor(Math.random() * correctGifs.length)]);
            } else {
              playWrongSound();
              setCurrentGif(wrongGifs[Math.floor(Math.random() * wrongGifs.length)]);
            }
            
          } else if (data.state === 'LEADERBOARD' || data.state === 'END') {
            if (data.players) setLeaderboard(data.players);
          }
        }
      });
    });
  };

  const submitAnswer = (index) => {
    if (myAnswer !== null || gameState !== 'QUESTION') return;
    setMyAnswer(index);
    if (connRef.current) {
      connRef.current.send({ type: 'ANSWER', answer: index });
    }
  };

  useEffect(() => {
    let timer;
    if (gameState === 'QUESTION' && timeLeft > 0 && myAnswer === null) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, myAnswer]);

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
        <form onSubmit={handleJoin} className="glass-panel rounded-3xl p-8 max-w-sm w-full text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Siapa namamu?</h2>
          <input
            type="text"
            placeholder="Ketik nama di sini..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-center text-xl font-bold mb-6 focus:outline-none focus:border-indigo-500"
            required
          />
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg transition">
            MASUK GAME
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      
      {/* Header */}
      <div className="bg-white p-4 shadow-md flex justify-between items-center">
        <div className="font-bold text-gray-600">{name}</div>
        <div className="bg-indigo-100 text-indigo-700 px-4 py-1 rounded-full font-black text-xl">
          Skor: {score}
        </div>
      </div>

      <div className="flex-grow flex flex-col items-center justify-center p-4">
        
        {gameState === 'LOBBY' && (
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600 animate-pulse">Menunggu Host Memulai...</div>
            <p className="mt-4 text-gray-500">Perhatikan layar di depan!</p>
          </div>
        )}

        {gameState === 'QUESTION' && (
          <div className="w-full max-w-4xl text-center">
            <div className="flex justify-between items-center mb-6">
              <span className="text-gray-500 font-bold text-xl">Waktu:</span>
              <span className="text-5xl font-black text-red-500">{timeLeft}</span>
            </div>
            
            <div className="bg-white rounded-3xl p-6 shadow-xl mb-8 border-2 border-indigo-100">
              <h2 className="text-xl md:text-2xl font-semibold text-gray-800 text-left whitespace-pre-wrap">{question?.text}</h2>
            </div>
            
            {myAnswer === null ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {question?.options.map((opt, i) => (
                  <button 
                    key={i}
                    onClick={() => submitAnswer(i)}
                    className={`${colors[i % 4]} hover:opacity-90 text-white font-bold py-6 px-6 rounded-2xl shadow-lg transform transition active:scale-95 text-lg md:text-xl min-h-[120px] flex items-center justify-center`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-2xl font-bold text-gray-500 animate-pulse mt-10">
                Menunggu pemain lain...
              </div>
            )}
          </div>
        )}

        {gameState === 'ANSWER_RESULT' && (
          <div className={`w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl text-center border-t-8 ${isCorrect ? 'border-green-500' : 'border-red-500'}`}>
            <h2 className={`text-4xl font-black mb-2 ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
              {isCorrect ? 'BENAR!' : 'SALAH!'}
            </h2>
            <p className="text-gray-500 font-medium mb-6">
              {isCorrect ? '+100 Poin & Bonus Waktu' : 'Tetap semangat!'}
            </p>
            
            {currentGif && (
              <div className="mt-4 rounded-xl overflow-hidden shadow-lg border-4 border-gray-100 flex justify-center bg-gray-50 p-2">
                <img src={currentGif} alt="Meme GIF" className="max-h-64 rounded-lg object-contain" />
              </div>
            )}
          </div>
        )}

        {gameState === 'LEADERBOARD' && (
          <div className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl text-center">
            <h2 className="text-3xl font-black text-indigo-700 mb-6">Papan Peringkat</h2>
            <div className="space-y-3">
              {leaderboard.map((p, i) => (
                <div key={p.id} className={`flex justify-between items-center p-3 rounded-xl border-l-8 ${p.name === name ? 'bg-indigo-100 border-indigo-600' : 'bg-gray-50 border-gray-300'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black text-gray-500">#{i+1}</span>
                    <span className="text-lg font-bold text-gray-800">{p.name} {p.name === name && '(Kamu)'}</span>
                  </div>
                  <span className="text-xl font-bold text-indigo-600">{p.score}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-500 mt-6 animate-pulse font-semibold">Menunggu Host...</p>
          </div>
        )}

        {gameState === 'END' && (
          <div className="text-center">
            <h2 className="text-4xl font-black text-indigo-600 mb-4">Permainan Selesai!</h2>
            <p className="text-xl text-gray-600">Terima kasih sudah bermain.</p>
          </div>
        )}

      </div>
    </div>
  );
}
