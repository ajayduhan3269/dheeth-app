const User = require('../models/User');
const Question = require('../models/Question');
const statesData = require('../../data/statesData.json');

const activeMatches = {};
const rematchState = {};

const SHIELD_HOURS = 12;

const handleConquest = async (userId, targetStateId) => {
  if (!userId || userId === 'bot' || userId === 'bot_user_id' || !targetStateId) return null;
  try {
    const state = statesData.find(s => s.id === targetStateId);
    if (!state) return null;
    const user = await User.findById(userId);
    if (!user) return null;
    if (user.conqueredStates.some(c => c.stateId === state.id)) return null;

    const allUsers = await User.find({ 'conqueredStates.stateId': state.id });
    const owner = allUsers.find(u => u.conqueredStates.some(c => c.stateId === state.id));

    if (owner && owner._id.toString() !== userId.toString()) {
      const conquest = owner.conqueredStates.find(c => c.stateId === state.id);

      // Shield blocks any takeover
      if (conquest.shieldUntil && new Date(conquest.shieldUntil) > new Date()) {
        return { type: 'shielded', stateName: state.name };
      }

      // Castle defense absorbs the hit (siege)
      if ((conquest.castleLevel || 1) > 1) {
        conquest.castleLevel -= 1;
        await owner.save();
        return { type: 'damaged', stateName: state.name, castleLevel: conquest.castleLevel };
      }

      // Castle broken - state is captured
      owner.conqueredStates = owner.conqueredStates.filter(c => c.stateId !== state.id);
      await owner.save();
    }

    user.conqueredStates.push({
      stateId: state.id,
      castleLevel: 1,
      ownedSince: new Date(),
      shieldUntil: new Date(Date.now() + SHIELD_HOURS * 3600 * 1000),
      lastTributeAt: new Date(),
    });
    await user.save();
    return { type: 'captured', stateName: state.name, castleLevel: 1 };
  } catch (_) {
    return null;
  }
};

const updateSeenAndWrongQuestions = async (userId, questions, playerAnswers) => {
  if (!userId || userId === 'bot' || userId === 'bot_user_id' || userId.startsWith('guest_')) return;
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const questionIds = questions.map(q => q._id);
    const wrongIds = [];

    questions.forEach((q, idx) => {
      const userAns = playerAnswers ? playerAnswers[idx] : null;
      if (userAns && userAns.toLowerCase() !== q.correctOption?.toLowerCase()) {
        wrongIds.push(q._id);
      }
    });

    // Add seen questions (avoid duplicates)
    const existingSeen = new Set((user.seenQuestions || []).map(id => id.toString()));
    const newSeen = questionIds.filter(id => !existingSeen.has(id.toString()));
    if (newSeen.length > 0) {
      user.seenQuestions.push(...newSeen);
    }

    // Update wrong questions: add new wrong ones, remove correctly answered ones
    const existingWrong = new Set((user.wrongQuestions || []).map(id => id.toString()));
    const wrongToAdd = wrongIds.filter(id => !existingWrong.has(id.toString()));
    const wrongToRemove = [];
    questions.forEach((q, idx) => {
      const userAns = playerAnswers ? playerAnswers[idx] : null;
      if (userAns && userAns.toLowerCase() === q.correctOption?.toLowerCase() && existingWrong.has(q._id.toString())) {
        wrongToRemove.push(q._id);
      }
    });

    if (wrongToAdd.length > 0) {
      user.wrongQuestions.push(...wrongToAdd);
    }
    if (wrongToRemove.length > 0) {
      user.wrongQuestions = user.wrongQuestions.filter(
        id => !wrongToRemove.some(removeId => removeId.toString() === id.toString())
      );
    }

    await user.save();
  } catch (err) {
    console.error(`Failed to update seen/wrong questions for user ${userId}:`, err);
  }
};

const updateDailyProgress = async (userId, questionsAnswered, isWin) => {
  if (!userId || userId === 'bot') return;
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    if (user.lastActiveDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (user.lastActiveDate !== yesterday && user.streak > 0) {
        if (user.streakFreeze > 0) user.streakFreeze -= 1;
        else user.streak = 0;
      }
      user.dailyQuestionsAnswered = 0;
      user.dailyWins = 0;
      user.lastActiveDate = today;
    }

    const prevCount = user.dailyQuestionsAnswered;
    user.dailyQuestionsAnswered += questionsAnswered || 5;
    if (isWin) user.dailyWins += 1;

    if (prevCount < user.dailyGoal && user.dailyQuestionsAnswered >= user.dailyGoal) {
      user.coins = (user.coins || 0) + 500;
      user.streak += 1;
      user.streakFreeze = (user.streakFreeze || 0) + 1;
    }

    await user.save();
  } catch (err) {
    console.error('Failed to update daily progress:', err);
  }
};

const updatePlayerStats = async (userId, isWinner, isDraw, subject, correctAnswers) => {
  if (!userId || userId === 'bot' || userId === 'bot_user_id' || userId.startsWith('guest_')) return { xpGained: 0, newLevel: 0 }; 

  const eloChange = isWinner ? 25 : (isDraw ? 5 : -15);
  const winIncrement = isWinner ? 1 : 0;
  
  const xpGained = (isWinner ? 50 : (isDraw ? 20 : 10)) + (correctAnswers * 5);
  const coinsGained = isWinner ? 50 : (isDraw ? 20 : 10);

  try {
    const user = await User.findById(userId);
    if (!user) return { xpGained: 0, newLevel: 0 };
    
    user.coins = (user.coins || 0) + coinsGained;
    
    if (!user.subjectXP) user.subjectXP = new Map();
    const currentXP = user.subjectXP.get(subject) || 0;
    const newXP = currentXP + xpGained;
    user.subjectXP.set(subject, newXP);
    
    user.matches += 1;
    user.wins += winIncrement;
    user.eloRating += eloChange;
    
    let maxXP = newXP;
    user.subjectXP.forEach((xp) => {
      if (xp > maxXP) maxXP = xp;
    });
    
    const calculateLevel = (xp) => Math.floor(Math.sqrt(xp / 100));
    const globalLevel = calculateLevel(maxXP);
    
    let newTitle = 'Novice';
    if (globalLevel >= 15) newTitle = 'Dheeth Legend';
    else if (globalLevel >= 10) newTitle = 'Master';
    else if (globalLevel >= 5) newTitle = 'Adept';
    
    user.title = newTitle;
    await user.save();
    
    return { xpGained, newTitle, newLevel: calculateLevel(newXP) };
  } catch (err) {
    console.error(`Failed to update stats for user ${userId}:`, err);
    return { xpGained: 0, newLevel: 0 };
  }
};

const initializeMatch = (roomId, subject, questions, p1, p2, isBotMatch) => {
  activeMatches[roomId] = {
    subject,
    questions,
    currentQuestionIndex: 0,
    isBotMatch,
    timeLeft: 60,
    timerInterval: null,
    players: {
      [p1.socketId]: { ...p1, score: 0, hasAnswered: false, correctAnswers: 0, currentStreak: 0, multiplier: 1 },
      [p2.socketId]: { ...p2, score: 0, hasAnswered: false, correctAnswers: 0, currentStreak: 0, multiplier: 1 }
    }
  };
};

const startQuestionTimer = (io, roomId) => {
  const match = activeMatches[roomId];
  if (!match) return;

  match.timeLeft = 60;
  Object.values(match.players).forEach(p => p.hasAnswered = false);

  if (match.timerInterval) clearInterval(match.timerInterval);
  if (match.botAnswerTimeout) clearTimeout(match.botAnswerTimeout);

  match.timerInterval = setInterval(() => {
    match.timeLeft--;
    io.to(roomId).emit('timer_tick', { timeLeft: match.timeLeft });

    if (match.timeLeft <= 0) {
      clearInterval(match.timerInterval);
      if (match.botAnswerTimeout) clearTimeout(match.botAnswerTimeout);
      io.to(roomId).emit('time_up');
      io.to(roomId).emit('reveal_answers', { 
        players: match.players, 
        questionIndex: match.currentQuestionIndex,
        correctOption: match.questions[match.currentQuestionIndex].correctOption
      });
      
      setTimeout(() => {
        moveToNextQuestion(io, roomId);
      }, 3000);
    }
  }, 1000);

  if (match.isBotMatch) {
    const botPlayer = Object.values(match.players).find(p => p.socketId === 'bot_socket_id');
    if (botPlayer) {
      const thinkingTime = Math.floor(Math.random() * (11 - 3 + 1) + 3) * 1000;
      
      match.botAnswerTimeout = setTimeout(() => {
        const currentMatch = activeMatches[roomId];
        if (!currentMatch) return;

        const bot = currentMatch.players['bot_socket_id'];
        if (bot && !bot.hasAnswered) {
          bot.hasAnswered = true;
          
          const currentQ = currentMatch.questions[currentMatch.currentQuestionIndex];
          const isCorrect = Math.random() < 0.80;
          
          bot.answers = bot.answers || [];
          bot.correctAnswers = bot.correctAnswers || 0;
          bot.currentStreak = bot.currentStreak || 0;

          if (isCorrect) {
            bot.answers[currentMatch.currentQuestionIndex] = currentQ.correctOption?.toUpperCase();
            bot.correctAnswers += 1;
            bot.currentStreak += 1;
            bot.multiplier = bot.currentStreak >= 5 ? 1.5 : (bot.currentStreak >= 3 ? 1.2 : 1);
            
            const isFinalRound = currentMatch.currentQuestionIndex === currentMatch.questions.length - 1;
            const roundMultiplier = isFinalRound ? 2 : 1;
            
            bot.score += Math.round(currentMatch.timeLeft * 10 * bot.multiplier * roundMultiplier);
          } else {
            bot.currentStreak = 0;
            bot.multiplier = 1;
            const incorrectOptions = ['A', 'B', 'C', 'D'].filter(opt => opt !== currentQ.correctOption?.toUpperCase());
            bot.answers[currentMatch.currentQuestionIndex] = incorrectOptions[Math.floor(Math.random() * incorrectOptions.length)];
          }
          
          io.to(roomId).emit('score_update', { players: currentMatch.players });

          const allAnswered = Object.values(currentMatch.players).every(p => p.hasAnswered);
          if (allAnswered) {
            clearInterval(currentMatch.timerInterval);
            io.to(roomId).emit('reveal_answers', { 
              players: currentMatch.players, 
              questionIndex: currentMatch.currentQuestionIndex,
              correctOption: currentMatch.questions[currentMatch.currentQuestionIndex].correctOption
            });
            setTimeout(() => moveToNextQuestion(io, roomId), 3000);
          }
        }
      }, thinkingTime);
    }
  }
};

const moveToNextQuestion = (io, roomId) => {
   const match = activeMatches[roomId];
   if (!match) return;

   if (match.botAnswerTimeout) {
     clearTimeout(match.botAnswerTimeout);
     delete match.botAnswerTimeout;
   }

   match.currentQuestionIndex++;
   if (match.currentQuestionIndex >= match.questions.length) {
       const playersList = Object.values(match.players);
       const p1 = playersList[0];
       const p2 = playersList[1];

       const p1Id = p1 ? p1.userId : null;
       const p2Id = p2 ? p2.userId : null;

       const p1Score = p1 ? p1.score : 0;
       const p2Score = p2 ? p2.score : 0;

       let isDraw = p1Score === p2Score;
       let p1Wins = p1Score > p2Score;
       let p2Wins = p2Score > p1Score;

       if (isDraw) {
           const p1Answers = p1?.correctAnswers || 0;
           const p2Answers = p2?.correctAnswers || 0;
           if (p1Answers > p2Answers) {
               p1Wins = true;
               isDraw = false;
           } else if (p2Answers > p1Answers) {
               p2Wins = true;
               isDraw = false;
           }
       }

       const eloChangeP1 = p1Wins ? 25 : (isDraw ? 5 : -15);
       const eloChangeP2 = p2Wins ? 25 : (isDraw ? 5 : -15);

        Promise.all([
          updatePlayerStats(p1Id, p1Wins, isDraw, match.subject, p1?.correctAnswers || 0),
          updatePlayerStats(p2Id, p2Wins, isDraw, match.subject, p2?.correctAnswers || 0),
          updateSeenAndWrongQuestions(p1Id, match.questions, p1?.answers),
          updateSeenAndWrongQuestions(p2Id, match.questions, p2?.answers),
          updateDailyProgress(p1Id, match.questions.length, p1Wins),
          updateDailyProgress(p2Id, match.questions.length, p2Wins)
         ]).then(async ([p1Stats, p2Stats]) => {
           console.log(`Stats updated for room. Match Over.`);

          // Conquer state for winners
          const p1Conquest = p1Wins ? await handleConquest(p1Id, p1?.targetState) : null;
          const p2Conquest = p2Wins ? await handleConquest(p2Id, p2?.targetState) : null;

          const createSummary = (isPlayer1) => {
           const me = (isPlayer1 ? p1 : p2) || { score: 0, correctAnswers: 0, answers: [] };
           const opp = (isPlayer1 ? p2 : p1) || { score: 0, correctAnswers: 0, answers: [] };
           const meWins = isPlayer1 ? p1Wins : p2Wins;
           const meEloChange = isPlayer1 ? eloChangeP1 : eloChangeP2;
           const myStats = isPlayer1 ? p1Stats : p2Stats;

           const conquest = isPlayer1 ? p1Conquest : p2Conquest;
           return {
              winner: isDraw ? 'draw' : (meWins ? 'user' : 'opponent'),
              userStats: { score: me.score, correctAnswers: me.correctAnswers || 0, eloChange: meEloChange, xpGained: myStats.xpGained || 0 },
              conquest,
              botStats: { score: opp.score, correctAnswers: opp.correctAnswers || 0 },
             questionsReview: match.questions.map((q, idx) => ({
               questionId: q._id,
               questionText: q.questionText,
               options: q.options,
               correctOption: q.correctOption,
               explanation: q.explanation,
               hasDiagram: q.hasDiagram,
               diagramUrl: q.diagramUrl,
               userSelectedOption: me.answers ? me.answers[idx] : null,
               opponentSelectedOption: opp.answers ? opp.answers[idx] : null
             }))
           };
         };

         if (p1 && !p1.socketId.startsWith('bot_')) {
           io.to(p1.socketId).emit('match_over', createSummary(true));
         }
         if (p2 && !p2.socketId.startsWith('bot_')) {
           io.to(p2.socketId).emit('match_over', createSummary(false));
         }

         // Save to rematch state before deleting
         rematchState[roomId] = {
           subject: match.subject,
           p1, p2,
           isBotMatch: match.isBotMatch,
           requests: {}
         };

         delete activeMatches[roomId];
       }).catch(err => {
         // Never let a match-end failure crash the whole server
         console.error(`[Match] Error finalizing ${roomId}:`, err);
         delete activeMatches[roomId];
       });
   } else {
       io.to(roomId).emit('next_question', { questionIndex: match.currentQuestionIndex });
       startQuestionTimer(io, roomId);
   }
};

const setupGameplaySockets = (io, socket) => {
  socket.on('submit_answer', (data) => {
    const { roomId, selectedOption } = data;
    const match = activeMatches[roomId];
    if (!match) return;

    const player = match.players[socket.id];
    if (player && !player.hasAnswered) {
       player.hasAnswered = true;
       
       player.answers = player.answers || [];
       player.answers[match.currentQuestionIndex] = selectedOption;

       const currentQ = match.questions[match.currentQuestionIndex];
       
       player.currentStreak = player.currentStreak || 0;
       
       const isCorrect = selectedOption?.toLowerCase() === currentQ.correctOption?.toLowerCase();
       if (isCorrect) {
           player.correctAnswers = (player.correctAnswers || 0) + 1;
           player.currentStreak += 1;
           player.multiplier = player.currentStreak >= 5 ? 1.5 : (player.currentStreak >= 3 ? 1.2 : 1);
           
           const isFinalRound = match.currentQuestionIndex === match.questions.length - 1;
           const roundMultiplier = isFinalRound ? 2 : 1;

           player.score += Math.round(match.timeLeft * 10 * player.multiplier * roundMultiplier);
       } else {
           player.currentStreak = 0;
           player.multiplier = 1;
       }

       socket.emit('answer_result', { isCorrect, selectedOption, correctOption: currentQ.correctOption });
       io.to(roomId).emit('score_update', { players: match.players });

       const allAnswered = Object.values(match.players).every(p => p.hasAnswered);
       if (allAnswered) {
           clearInterval(match.timerInterval);
           if (match.botAnswerTimeout) clearTimeout(match.botAnswerTimeout);
           io.to(roomId).emit('reveal_answers', { 
             players: match.players, 
             questionIndex: match.currentQuestionIndex,
             correctOption: match.questions[match.currentQuestionIndex].correctOption
           });
           setTimeout(() => moveToNextQuestion(io, roomId), 3000);
       }
    }
  });

  socket.on('request_rematch', async (data) => {
    const { roomId } = data;
    const state = rematchState[roomId];
    if (!state) return;
    
    state.requests[socket.id] = true;
    io.to(roomId).emit('rematch_status', { acceptedCount: Object.keys(state.requests).length });

    if (state.isBotMatch) {
       if (!state.botTimeout) {
         state.botTimeout = setTimeout(async () => {
             const questions = await Question.aggregate([{ $match: { subject: state.subject } }, { $sample: { size: 5 } }]);
             const pId = socket.user.id || socket.user.userId;
             const dbUser = await User.findById(pId);
             const pAvatar = dbUser?.equippedAvatar || socket.user.avatarSeed || 'default-seed';
             const botOpp = state.p2.socketId === 'bot_socket_id' ? state.p2 : state.p1;
             
             const matchPayload = {
               roomId, subject: state.subject, questions, isBotMatch: true,
               player: { id: pId, username: socket.user.username, avatarSeed: pAvatar },
               opponent: { id: "bot", username: botOpp.username, avatarSeed: "bot-ronin" }
             };
             
             io.to(roomId).emit('rematch_accepted', matchPayload);
             initializeMatch(roomId, state.subject, questions, { socketId: socket.id, username: socket.user.username, userId: pId, avatarSeed: pAvatar }, { socketId: "bot_socket_id", username: botOpp.username, userId: "bot", avatarSeed: "bot-ronin" }, true);
             setTimeout(() => startQuestionTimer(io, roomId), 3500);
             
             delete rematchState[roomId];
         }, Math.random() * 2000 + 1500);
       }
    } else {
       if (Object.keys(state.requests).length === 2) {
          const questions = await Question.aggregate([{ $match: { subject: state.subject } }, { $sample: { size: 5 } }]);
          
          const p1Payload = {
            roomId, subject: state.subject, questions, isBotMatch: false,
            player: { id: state.p1.userId, username: state.p1.username, avatarSeed: state.p1.avatarSeed },
            opponent: { id: state.p2.userId, username: state.p2.username, avatarSeed: state.p2.avatarSeed }
          };
          const p2Payload = {
            roomId, subject: state.subject, questions, isBotMatch: false,
            player: { id: state.p2.userId, username: state.p2.username, avatarSeed: state.p2.avatarSeed },
            opponent: { id: state.p1.userId, username: state.p1.username, avatarSeed: state.p1.avatarSeed }
          };

          io.to(state.p1.socketId).emit('rematch_accepted', p1Payload);
          io.to(state.p2.socketId).emit('rematch_accepted', p2Payload);
          
          initializeMatch(roomId, state.subject, questions, state.p1, state.p2, false);
          setTimeout(() => startQuestionTimer(io, roomId), 3500);
          
          delete rematchState[roomId];
       }
    }
  });

  socket.on('send_reaction', (data) => {
    const { roomId, emoji } = data;
    socket.to(roomId).emit('receive_reaction', { emoji });
  });
  
  socket.on('disconnect', () => {
      for (const roomId in activeMatches) {
         const match = activeMatches[roomId];
         if (match.players[socket.id]) {
             clearInterval(match.timerInterval);
             if (match.botAnswerTimeout) clearTimeout(match.botAnswerTimeout);
             
             io.to(roomId).emit('opponent_disconnected', {
               message: 'Opponent fled the arena. You win by forfeit!'
             });
             
             const playersList = Object.values(match.players);
             const disconnectedPlayer = match.players[socket.id];
             const remainingPlayer = playersList.find(p => p.socketId !== socket.id);

             const loserId = disconnectedPlayer.userId;
             const winnerId = remainingPlayer ? remainingPlayer.userId : null;

              Promise.all([
                updatePlayerStats(loserId, false, false, match.subject, 0),
                updatePlayerStats(winnerId, true, false, match.subject, remainingPlayer?.correctAnswers || 0),
                updateDailyProgress(loserId, 5, false),
                updateDailyProgress(winnerId, 5, true)
              ]).then(() => console.log('Stats updated after forfeit.'))
                .catch(err => console.error('[Match] Forfeit stats error:', err));

             delete activeMatches[roomId];
         }
      }
  });
};

module.exports = { initializeMatch, startQuestionTimer, setupGameplaySockets };
