const { loadCommands, deployCommands } = require('../handlers/commandHandler');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`Logged in as ${client.user.tag}`);
        
        const commands = loadCommands(client);
        await deployCommands(commands);
    },
}; 