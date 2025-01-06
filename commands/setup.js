const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    StringSelectMenuBuilder
} = require('discord.js');
const { hasPermission } = require('../handlers/permissionHandler');

const setupCache = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup a new form template'),
        
    async execute(interaction) {
        if (!hasPermission(interaction.member, 'setup_command')) {
            return interaction.reply({ 
                content: 'You do not have permission to use this command. Required roles are missing.', 
                ephemeral: true 
            });
        }

        setupCache.set(interaction.user.id, {
            embed: {
                title: 'New Form',
                description: 'Click the button below to submit a form',
                color: '#0099ff',
                thumbnail: null,
                footer: null
            },
            fields: [],
            channel: null,
            public_channel: null,
            form_type: 'private',
            requires_approval: false,
            button: {
                label: 'Submit Form',
                style: ButtonStyle.Primary
            }
        });

        const setupEmbed = new EmbedBuilder()
            .setTitle('Form Setup')
            .setDescription('Customize your form by using the buttons below')
            .setColor('#0099ff')
            .addFields(
                { name: 'Current Settings', value: '**Form Type:** Private\n\nNo other settings configured yet' }
            );

        const embedButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('setup_title')
                .setLabel('Set Title')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('setup_description')
                .setLabel('Set Description')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('setup_color')
                .setLabel('Set Color')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('setup_thumbnail')
                .setLabel('Set Thumbnail')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('setup_footer')
                .setLabel('Set Footer')
                .setStyle(ButtonStyle.Primary)
        );

        const formButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('setup_fields')
                .setLabel('Add Form Field')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('setup_button')
                .setLabel('Customize Button')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('setup_channel')
                .setLabel('Set Response Channel')
                .setStyle(ButtonStyle.Success)
        );

        const formTypeRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('setup_form_type')
                .setPlaceholder('Form Type: Private')
                .addOptions([
                    {
                        label: 'Private Form',
                        description: 'Responses are only visible to staff',
                        value: 'private',
                        default: true
                    },
                    {
                        label: 'Public Form',
                        description: 'Approved responses are posted publicly',
                        value: 'public'
                    },
                    {
                        label: 'Suggestion Form',
                        description: 'Approved suggestions can be voted on',
                        value: 'suggestion'
                    }
                ])
        );

        const controlButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('setup_public_channel')
                .setLabel('Set Public Channel')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('setup_preview')
                .setLabel('Preview')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('setup_accept')
                .setLabel('Accept')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('setup_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        try {
            await interaction.reply({
                embeds: [setupEmbed],
                components: [embedButtons, formButtons, formTypeRow, controlButtons],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error in setup command:', error);
            await interaction.reply({
                content: 'There was an error setting up the form. Please try again.',
                ephemeral: true
            });
        }
    },
};

function getSetupEmbed(setupData) {
    const embed = new EmbedBuilder()
        .setTitle('Form Setup')
        .setDescription('Customize your form by using the buttons below')
        .setColor('#0099ff');

    let settingsText = '';
    settingsText += `**Title:** ${truncateText(setupData.embed.title, 256)}\n`;
    settingsText += `**Description:** ${truncateText(setupData.embed.description, 100)}\n`;
    settingsText += `**Color:** ${setupData.embed.color}\n`;
    settingsText += `**Thumbnail:** ${setupData.embed.thumbnail ? truncateText(setupData.embed.thumbnail, 100) : 'Not set'}\n`;
    settingsText += `**Footer:** ${setupData.embed.footer ? truncateText(setupData.embed.footer, 100) : 'Not set'}\n`;
    settingsText += `**Response Channel:** ${setupData.channel ? `<#${setupData.channel}>` : 'Not set'}\n`;
    settingsText += `**Form Type:** ${setupData.form_type.charAt(0).toUpperCase() + setupData.form_type.slice(1)}\n`;
    if (setupData.form_type !== 'private') {
        settingsText += `**Public Channel:** ${setupData.public_channel ? `<#${setupData.public_channel}>` : 'Not set'}\n`;
    }
    settingsText += `**Button Label:** ${truncateText(setupData.button.label, 80)}\n`;
    settingsText += `**Button Style:** ${ButtonStyle[setupData.button.style]}\n\n`;

    if (setupData.fields.length > 0) {
        settingsText += `**Form Fields (${setupData.fields.length}/5):**\n`;
        setupData.fields.forEach((field, index) => {
            settingsText += `**${index + 1}.** ${truncateText(field.label, 45)} ${field.required ? '(Required)' : '(Optional)'}\n   Placeholder: ${field.placeholder ? truncateText(field.placeholder, 100) : 'None'}\n\n`;
        });
    } else {
        settingsText += '**No form fields added yet (0/5)**';
    }

    embed.addFields({ name: 'Current Settings', value: truncateText(settingsText, 1024) });
    return embed;
}

module.exports.setupCache = setupCache;
module.exports.getSetupEmbed = getSetupEmbed; 