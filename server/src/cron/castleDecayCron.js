const cron = require('node-cron');
const User = require('../models/User'); // Adjust path if necessary based on your folder structure

const DECAY_HOURS = 48;

const startDecayCron = () => {
  // Runs at minute 0 of every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Running castle decay and cooldown cleanup...');
    try {
      // 1. Find all users who have conqueredStates
      const users = await User.find({ 'conqueredStates.0': { $exists: true } });
      const savePromises = [];

      for (const user of users) {
        let needsSave = false;

        // 5. Clean up expired entries from the siegeCooldowns array
        if (user.siegeCooldowns && user.siegeCooldowns.length > 0) {
          const now = new Date();
          const activeCooldowns = user.siegeCooldowns.filter(c => new Date(c.expiresAt) > now);
          
          if (activeCooldowns.length !== user.siegeCooldowns.length) {
            user.siegeCooldowns = activeCooldowns;
            needsSave = true;
          }
        }

        // 2 & 3. Check maintenance and apply decay
        for (const conquest of user.conqueredStates) {
          if (!conquest.lastMaintainedAt) {
            conquest.lastMaintainedAt = conquest.ownedSince || new Date();
          }

          const lastMaintained = new Date(conquest.lastMaintainedAt);
          const hoursSince = (Date.now() - lastMaintained.getTime()) / 3600000;
          const levelsToDecay = Math.floor(hoursSince / DECAY_HOURS);

          if (levelsToDecay > 0 && conquest.castleLevel > 1) {
            // Reduce castleLevel by levelsToDecay, minimum 1
            conquest.castleLevel = Math.max(1, conquest.castleLevel - levelsToDecay);
            
            // Advance the lastMaintainedAt to account for the consumed decay time
            // This prevents continuous decay on the next hourly tick if no maintenance occurs
            conquest.lastMaintainedAt = new Date(lastMaintained.getTime() + (levelsToDecay * DECAY_HOURS * 3600000));
            needsSave = true;
          }
        }

        // 4. Save updated users
        if (needsSave) {
          savePromises.push(user.save());
        }
      }

      if (savePromises.length > 0) {
        await Promise.all(savePromises);
        console.log(`[Cron] Successfully processed decay and cooldowns for ${savePromises.length} users.`);
      } else {
        console.log('[Cron] No users required updates.');
      }
    } catch (error) {
      console.error('[Cron] Error running decay cron:', error);
    }
  });
};

module.exports = { startDecayCron };
