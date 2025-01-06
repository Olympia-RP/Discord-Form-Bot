const yaml = require('js-yaml');
const fs = require('fs');

const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));

/**
 * @param {Object} member
 * @param {String} permissionKey
 * @returns {Boolean}
 */
function hasPermission(member, permissionKey) {
    const guildConfig = config.guilds.find(g => g.id === member.guild.id);
    
    if (!guildConfig || 
        !guildConfig.permissions[permissionKey] || 
        !guildConfig.permissions[permissionKey].roles) {
        return false;
    }

    const allowedRoles = guildConfig.permissions[permissionKey].roles;

    return member.roles.cache.some(role => allowedRoles.includes(role.id));
}

/**
 * @returns {String[]}
 */
function getConfiguredGuildIds() {
    return config.guilds.map(guild => guild.id);
}

module.exports = { hasPermission, getConfiguredGuildIds }; 