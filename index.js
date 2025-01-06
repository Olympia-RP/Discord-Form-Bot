const { Client, GatewayIntentBits, Partials } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');
const { loadEvents } = require('./handlers/eventHandler');

const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction
    ]
});

loadEvents(client);

client.login(config.bot.token); 