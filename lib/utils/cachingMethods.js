const fs = require('fs');
// const { standardizeName } = require('../sources/wnba/playerIdMethods');

const standardizeName = (name, removeSpaces=false) => {
    const standardizedName = name
        .replace(/ü/g, 'u')
        .replace(/í/g, 'i')
        .replace(/é/g, 'e')
        .replace(/è/g, 'e')
        .replace(/ñ/g, 'n')
        .replace(/ö/g, 'o')
        .replace(/-/g, ' ')
        .replace(/'/g, '')
        .toLowerCase();
    return removeSpaces ? standardizedName.replace(/\s/g, '') : standardizedName;
}

const cacheIsExpired = (cache, cacheValidHours) => {
    if (!cache) {
        return true;
    }

    return Date.now().valueOf() - (new Date(cache.date)).valueOf() >= cacheValidHours * 3600000;
}

const getCachedPlayerStatsPath = (name, dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
        // add automatic gitignoring here?
    }
    return `${dir}/${standardizeName(name)}.json`;
}

const cachePlayerStats = (name, stats, path) => {
    fs.writeFile(path, JSON.stringify({
        date: new Date(),
        ...stats
    }), (err) => {
        if (err) {
            console.log('Error caching stats:', err);
        } else {
            console.log('Cached stats for', name);
        }
    });
}

const getCachedPlayerStats = (name, path, cacheValidHours = 2) => {
    return new Promise((resolve, reject) => {
        fs.readFile(path, 'utf8', (err, contents) => {
            const cache = contents ? JSON.parse(contents) : contents;
            if(cache && !cacheIsExpired(cache, cacheValidHours)) {
                resolve(cache);
            } else {
                resolve(null);
            }
        })
    })
}

const getStatsFromCache = (name, stats, path, opts={cacheValidHours: 2, skipIfStatsMissing: true}) => {
    const { cacheValidHours, skipIfStatsMissing } = opts

    return getCachedPlayerStats(name, getCachedPlayerStatsPath(name, path), cacheValidHours).then((cachedPlayerStats) => {
        if (!cachedPlayerStats) {
            return null;
        }

        const statsObj = {};
        let statMissingFromCache = false;
        stats.forEach((stat) => {
            if (!cachedPlayerStats[stat] && stat !== 'THREE_PERCENTAGE' && stat !== 'WNBA_3%') {
                // console.log(`${stat} missing from cache for ${name}`);
                statMissingFromCache = true;
            }

            statsObj[stat] = cachedPlayerStats[stat];
        });

        const result = statMissingFromCache && skipIfStatsMissing ? null : statsObj;

        if (result) {
          console.log(`Got player stats for ${name} from cache`);
        }

        return result;
    });
}

module.exports = {
    cacheIsExpired,
    cachePlayerStats,
    getCachedPlayerStats,
    getCachedPlayerStatsPath,
    getStatsFromCache,
    standardizeName
};
