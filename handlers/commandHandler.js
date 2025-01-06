const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const yaml = require('js-yaml');
const { getConfiguredGuildIds } = require('./permissionHandler');

const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const commands = new Map();

function loadCommands(client) {
    const commandsPath = path.join(process.cwd(), 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            commands.set(command.data.name, command);
        }
    }

    client.commands = commands;
    return Array.from(commands.values()).map(command => command.data.toJSON());
}

async function deployCommands(commandsArray) {
    try {
        const rest = new REST({ version: '10' }).setToken(config.bot.token);
        console.log('Started refreshing application commands.');

        const guildIds = getConfiguredGuildIds();

        for (const guildId of guildIds) {
            try {
                console.log(`Registering commands for guild ${guildId}...`);
                await rest.put(
                    Routes.applicationGuildCommands(config.bot.client_id, guildId),
                    { body: commandsArray },
                );
                console.log(`Successfully registered commands for guild ${guildId}`);
            } catch (error) {
                console.error(`Failed to register commands for guild ${guildId}:`, error);
            }
        }

        console.log('Finished refreshing application commands.');
    } catch (error) {
        console.error('Failed to refresh application commands:', error);
    }
}

module.exports = { loadCommands, deployCommands, commands }; 