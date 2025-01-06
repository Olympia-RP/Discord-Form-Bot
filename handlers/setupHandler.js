const { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder
} = require('discord.js');
const db = require('../database/init');
const { setupCache } = require('../commands/setup');

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

function getSetupEmbed(setupData) {
    const embed = new EmbedBuilder()
        .setTitle('Form Setup')
        .setDescription('Customize your form by using the buttons below')
        .setColor('#0099ff');

    let settingsText = '';
    settingsText += `**Form Type:** ${setupData.form_type.charAt(0).toUpperCase() + setupData.form_type.slice(1)}\n\n`;
    settingsText += `**Title:** ${truncateText(setupData.embed.title, 256)}\n`;
    settingsText += `**Description:** ${truncateText(setupData.embed.description, 100)}\n`;
    settingsText += `**Color:** ${setupData.embed.color}\n`;
    settingsText += `**Thumbnail:** ${setupData.embed.thumbnail ? truncateText(setupData.embed.thumbnail, 100) : 'Not set'}\n`;
    settingsText += `**Footer:** ${setupData.embed.footer ? truncateText(setupData.embed.footer, 100) : 'Not set'}\n`;
    settingsText += `**Form Channel:** ${setupData.form_channel ? `<#${setupData.form_channel}>` : 'Not set'}\n`;
    settingsText += `**Response Channel:** ${setupData.response_channel ? `<#${setupData.response_channel}>` : 'Not set'}\n`;
    if (setupData.form_type !== 'private') {
        settingsText += `**Public Channel:** ${setupData.public_channel ? `<#${setupData.public_channel}>` : 'Not set (Required)'}\n`;
    }
    settingsText += `**Button Label:** ${truncateText(setupData.button.label, 80)}\n`;
    settingsText += `**Button Style:** ${ButtonStyle[setupData.button.style]}\n\n`;

    if (setupData.fields.length > 0) {
        settingsText += `**Form Fields (${setupData.fields.length}/5):**\n`;
        setupData.fields.forEach((field, index) => {
            settingsText += `**${index + 1}.** ${truncateText(field.label, 45)} ${field.required ? '(Required)' : '(Optional)'}\n   Placeholder: ${field.placeholder ? truncateText(field.placeholder, 100) : 'None'}\n\n`;
        });
    } else {
        settingsText += 'No form fields added yet (0/5)';
    }

    embed.addFields({ name: 'Current Settings', value: truncateText(settingsText, 1024) });
    return embed;
}

async function handleSetupButton(interaction) {
    
    const setupData = setupCache.get(interaction.user.id);
    if (!setupData) {
        return interaction.reply({
            content: 'Setup session expired. Please run /setup again.',
            ephemeral: true
        });
    }

    const fullAction = interaction.customId.replace('setup_', '');

    try {
        switch (fullAction) {
            case 'title':
            case 'description':
            case 'footer':
                await showTextModal(interaction, fullAction);
                break;

            case 'color':
                await showColorModal(interaction);
                break;

            case 'thumbnail':
                await showThumbnailModal(interaction);
                break;

            case 'fields':
                await showFieldModal(interaction);
                break;

            case 'button':
                await showButtonCustomizationModal(interaction);
                break;

            case 'channel':
                await showChannelModal(interaction);
                break;

            case 'public_channel':
                if (setupData.form_type === 'private') {
                    await interaction.reply({
                        content: 'Public channel is only available for public and suggestion forms.',
                        ephemeral: true
                    });
                } else {
                    await showPublicChannelModal(interaction);
                }
                break;

            case 'preview':
                await showPreview(interaction, setupData);
                break;

            case 'accept':
                await saveForm(interaction, setupData);
                break;

            case 'cancel':
                setupCache.delete(interaction.user.id);
                await interaction.update({
                    content: 'Setup cancelled.',
                    embeds: [],
                    components: []
                });
                break;

            default:
                console.log('Unknown button action:', fullAction);
                break;
        }
    } catch (error) {
        console.error('Error in handleSetupButton:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'There was an error processing your request. Please try again.',
                ephemeral: true
            });
        }
    }
}

async function showTextModal(interaction, field) {
    const modal = new ModalBuilder()
        .setCustomId(`setup_modal_${field}`)
        .setTitle(`Set ${field.charAt(0).toUpperCase() + field.slice(1)}`);

    const input = new TextInputBuilder()
        .setCustomId(field)
        .setLabel(`Enter ${field}`)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setValue(setupCache.get(interaction.user.id).embed[field] || '');

    switch (field) {
        case 'title':
            input.setMaxLength(256);
            break;
        case 'description':
            input.setMaxLength(4000);
            break;
        case 'footer':
            input.setMaxLength(2048);
            break;
    }

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

async function showColorModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('setup_modal_color')
        .setTitle('Set Color');

    const input = new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Enter hex color (e.g., #FF0000)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(7)
        .setValue(setupCache.get(interaction.user.id).embed.color || '#0099ff');

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

async function showThumbnailModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('setup_modal_thumbnail')
        .setTitle('Set Thumbnail');

    const input = new TextInputBuilder()
        .setCustomId('thumbnail')
        .setLabel('Enter thumbnail URL')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(1024)
        .setValue(setupCache.get(interaction.user.id).embed.thumbnail || '');

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

async function showFieldModal(interaction) {
    const setupData = setupCache.get(interaction.user.id);
    
    if (setupData.fields.length >= 5) {
        return interaction.reply({
            content: 'Maximum of 5 fields allowed per form.',
            ephemeral: true
        });
    }

    const modal = new ModalBuilder()
        .setCustomId('setup_modal_field')
        .setTitle('Add Form Field');

    const labelInput = new TextInputBuilder()
        .setCustomId('field_label')
        .setLabel('Field Label (max 45 chars)')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(45)
        .setRequired(true);

    const placeholderInput = new TextInputBuilder()
        .setCustomId('field_placeholder')
        .setLabel('Placeholder Text (max 100 chars)')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(false);

    const requiredInput = new TextInputBuilder()
        .setCustomId('field_required')
        .setLabel('Required? (yes/no)')
        .setStyle(TextInputStyle.Short)
        .setValue('yes')
        .setMaxLength(3)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(labelInput),
        new ActionRowBuilder().addComponents(placeholderInput),
        new ActionRowBuilder().addComponents(requiredInput)
    );

    await interaction.showModal(modal);
}

async function showButtonCustomizationModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('setup_modal_button')
        .setTitle('Customize Button');

    const labelInput = new TextInputBuilder()
        .setCustomId('button_label')
        .setLabel('Button Label')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(80)
        .setValue(setupCache.get(interaction.user.id).button.label);

    const styleInput = new TextInputBuilder()
        .setCustomId('button_style')
        .setLabel('Style (PRIMARY, SECONDARY, SUCCESS, DANGER)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(9)
        .setValue(ButtonStyle[setupCache.get(interaction.user.id).button.style]);

    modal.addComponents(
        new ActionRowBuilder().addComponents(labelInput),
        new ActionRowBuilder().addComponents(styleInput)
    );

    await interaction.showModal(modal);
}

async function showChannelModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('setup_modal_channel')
        .setTitle('Set Channels');

    const formChannelInput = new TextInputBuilder()
        .setCustomId('form_channel')
        .setLabel('Form Channel ID (where form will be posted)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20)
        .setValue(setupCache.get(interaction.user.id).form_channel || '');

    const responseChannelInput = new TextInputBuilder()
        .setCustomId('response_channel')
        .setLabel('Response Channel ID (for staff responses)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20)
        .setValue(setupCache.get(interaction.user.id).response_channel || '');

    modal.addComponents(
        new ActionRowBuilder().addComponents(formChannelInput),
        new ActionRowBuilder().addComponents(responseChannelInput)
    );

    await interaction.showModal(modal);
}

async function showPreview(interaction, setupData) {
    const previewEmbed = new EmbedBuilder()
        .setTitle(setupData.embed.title)
        .setDescription(setupData.embed.description)
        .setColor(setupData.embed.color);

    if (setupData.embed.thumbnail) {
        previewEmbed.setThumbnail(setupData.embed.thumbnail);
    }
    if (setupData.embed.footer) {
        previewEmbed.setFooter({ text: setupData.embed.footer });
    }

    const button = new ButtonBuilder()
        .setCustomId('preview_button')
        .setLabel(setupData.button.label)
        .setStyle(setupData.button.style);

    const row = new ActionRowBuilder().addComponents(button);

    await interaction.reply({
        content: 'Form Preview:',
        embeds: [previewEmbed],
        components: [row],
        ephemeral: true
    });
}

async function saveForm(interaction, setupData) {
    if (!setupData.form_channel || !setupData.response_channel || setupData.fields.length === 0) {
        return interaction.reply({
            content: 'Please set both form and response channels and add at least one form field before saving.',
            ephemeral: true
        });
    }

    if (setupData.form_type !== 'private' && !setupData.public_channel) {
        return interaction.reply({
            content: `${setupData.form_type === 'suggestion' ? 'Suggestion' : 'Public'} forms require a public channel to be set.`,
            ephemeral: true
        });
    }

    db.run(
        `INSERT INTO form_templates (
            guild_id, 
            name, 
            fields, 
            form_channel_id,
            response_channel_id, 
            public_channel_id,
            form_type,
            requires_approval
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            interaction.guildId,
            setupData.embed.title,
            JSON.stringify({
                fields: setupData.fields,
                embed: setupData.embed,
                button: setupData.button
            }),
            setupData.form_channel,
            setupData.response_channel,
            setupData.public_channel,
            setupData.form_type,
            setupData.requires_approval
        ],
        async function(err) {
            if (err) {
                console.error('Error saving form template:', err);
                return interaction.reply({
                    content: 'Error saving form template.',
                    ephemeral: true
                });
            }

            const formEmbed = new EmbedBuilder()
                .setTitle(setupData.embed.title)
                .setDescription(setupData.embed.description)
                .setColor(setupData.embed.color);

            if (setupData.embed.thumbnail) {
                formEmbed.setThumbnail(setupData.embed.thumbnail);
            }
            if (setupData.embed.footer) {
                formEmbed.setFooter({ text: setupData.embed.footer });
            }

            const button = new ButtonBuilder()
                .setCustomId(`openForm_${this.lastID}`)
                .setLabel(setupData.button.label)
                .setStyle(setupData.button.style);

            const row = new ActionRowBuilder().addComponents(button);

            const formChannel = await interaction.guild.channels.fetch(setupData.form_channel);
            await formChannel.send({
                embeds: [formEmbed],
                components: [row]
            });

            setupCache.delete(interaction.user.id);
            await interaction.update({
                content: 'Form created successfully!',
                embeds: [],
                components: []
            });
        }
    );
}

async function showPublicChannelModal(interaction) {
    
    const setupData = setupCache.get(interaction.user.id);
    if (!setupData) {
        return interaction.reply({
            content: 'Setup session expired. Please run /setup again.',
            ephemeral: true
        });
    }

    if (setupData.form_type === 'private') {
        return interaction.reply({
            content: 'Public channel is only available for public and suggestion forms.',
            ephemeral: true
        });
    }

    try {
        const modal = new ModalBuilder()
            .setCustomId('setup_modal_public_channel')
            .setTitle('Set Public Channel');

        const input = new TextInputBuilder()
            .setCustomId('public_channel')
            .setLabel('Enter public channel ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(20);

        if (setupData.public_channel) {
            input.setValue(setupData.public_channel);
        }

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        
        await interaction.showModal(modal);
    } catch (error) {
        console.error('Error in showPublicChannelModal:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'There was an error showing the modal. Please try again.',
                ephemeral: true
            });
        }
    }
}

async function handleSetupModal(interaction) {
    const setupData = setupCache.get(interaction.user.id);
    if (!setupData) {
        return interaction.reply({
            content: 'Setup session expired. Please run /setup again.',
            ephemeral: true
        });
    }

    const modalParts = interaction.customId.split('_');
    const modalType = modalParts.slice(2).join('_');

    try {
        switch (modalType) {
            case 'title':
            case 'description':
            case 'footer':
                setupData.embed[modalType] = interaction.fields.getTextInputValue(modalType);
                break;

            case 'color':
                const color = interaction.fields.getTextInputValue('color');
                if (!/^#[0-9A-F]{6}$/i.test(color)) {
                    return interaction.reply({
                        content: 'Invalid hex color format. Please use format #RRGGBB (e.g., #FF0000)',
                        ephemeral: true
                    });
                }
                setupData.embed.color = color;
                break;

            case 'thumbnail':
                const thumbnail = interaction.fields.getTextInputValue('thumbnail');
                if (!/^https?:\/\/.+/i.test(thumbnail)) {
                    return interaction.reply({
                        content: 'Invalid URL format. Please enter a valid HTTP/HTTPS URL.',
                        ephemeral: true
                    });
                }
                setupData.embed.thumbnail = thumbnail;
                break;

            case 'field':
                setupData.fields.push({
                    label: interaction.fields.getTextInputValue('field_label'),
                    placeholder: interaction.fields.getTextInputValue('field_placeholder'),
                    required: interaction.fields.getTextInputValue('field_required').toLowerCase() === 'yes'
                });
                break;

            case 'button':
                const style = interaction.fields.getTextInputValue('button_style').toUpperCase();
                if (!ButtonStyle[style]) {
                    return interaction.reply({
                        content: 'Invalid button style. Please use PRIMARY, SECONDARY, SUCCESS, or DANGER.',
                        ephemeral: true
                    });
                }
                setupData.button.label = interaction.fields.getTextInputValue('button_label');
                setupData.button.style = ButtonStyle[style];
                break;

            case 'channel':
                const formChannelId = interaction.fields.getTextInputValue('form_channel');
                const responseChannelId = interaction.fields.getTextInputValue('response_channel');
                try {
                    const formChannel = await interaction.guild.channels.fetch(formChannelId);
                    const responseChannel = await interaction.guild.channels.fetch(responseChannelId);
                    if (!formChannel || !responseChannel) throw new Error('Channel not found');
                    setupData.form_channel = formChannelId;
                    setupData.response_channel = responseChannelId;
                } catch (error) {
                    return interaction.reply({
                        content: 'Invalid channel ID. Please enter valid channel IDs from this server.',
                        ephemeral: true
                    });
                }
                break;

            case 'public_channel':
                const publicChannelId = interaction.fields.getTextInputValue('public_channel');
                try {
                    const channel = await interaction.guild.channels.fetch(publicChannelId);
                    if (!channel) throw new Error('Channel not found');
                    setupData.public_channel = publicChannelId;
                } catch (error) {
                    return interaction.reply({
                        content: 'Invalid channel ID. Please enter a valid channel ID from this server.',
                        ephemeral: true
                    });
                }
                break;

            default:
                console.log('Unknown modal type:', modalType);
                break;
        }

        const canAccept = setupData.form_channel && setupData.response_channel && setupData.fields.length > 0 && 
            (setupData.form_type === 'private' || 
            (setupData.form_type !== 'private' && setupData.public_channel));

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
                .setPlaceholder(`Form Type: ${setupData.form_type.charAt(0).toUpperCase() + setupData.form_type.slice(1)}`)
                .addOptions([
                    {
                        label: 'Private Form',
                        description: 'Responses are only visible to staff',
                        value: 'private',
                        default: setupData.form_type === 'private'
                    },
                    {
                        label: 'Public Form',
                        description: 'Approved responses are posted publicly',
                        value: 'public',
                        default: setupData.form_type === 'public'
                    },
                    {
                        label: 'Suggestion Form',
                        description: 'Approved suggestions can be voted on',
                        value: 'suggestion',
                        default: setupData.form_type === 'suggestion'
                    }
                ])
        );

        const controlButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('setup_public_channel')
                .setLabel('Set Public Channel')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(setupData.form_type === 'private'),
            new ButtonBuilder()
                .setCustomId('setup_preview')
                .setLabel('Preview')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('setup_accept')
                .setLabel('Accept')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!canAccept),
            new ButtonBuilder()
                .setCustomId('setup_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.update({
            embeds: [getSetupEmbed(setupData)],
            components: [embedButtons, formButtons, formTypeRow, controlButtons]
        });
    } catch (error) {
        console.error('Error in handleSetupModal:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'There was an error processing your request. Please try again.',
                ephemeral: true
            });
        }
    }
}

async function handleFormTypeSelect(interaction) {
    const setupData = setupCache.get(interaction.user.id);
    if (!setupData) {
        return interaction.reply({
            content: 'Setup session expired. Please run /setup again.',
            ephemeral: true
        });
    }

    const newFormType = interaction.values[0];
    setupData.form_type = newFormType;
    setupData.requires_approval = newFormType !== 'private';
    
    if (newFormType === 'private') {
        setupData.public_channel = null;
    }

    const canAccept = setupData.form_channel && setupData.response_channel && setupData.fields.length > 0 && 
        (newFormType === 'private' || 
        (newFormType !== 'private' && setupData.public_channel));

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
            .setPlaceholder(`Form Type: ${newFormType.charAt(0).toUpperCase() + newFormType.slice(1)}`)
            .addOptions([
                {
                    label: 'Private Form',
                    description: 'Responses are only visible to staff',
                    value: 'private',
                    default: newFormType === 'private'
                },
                {
                    label: 'Public Form',
                    description: 'Approved responses are posted publicly',
                    value: 'public',
                    default: newFormType === 'public'
                },
                {
                    label: 'Suggestion Form',
                    description: 'Approved suggestions can be voted on',
                    value: 'suggestion',
                    default: newFormType === 'suggestion'
                }
            ])
    );

    const controlButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('setup_public_channel')
            .setLabel('Set Public Channel')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(newFormType === 'private'),
        new ButtonBuilder()
            .setCustomId('setup_preview')
            .setLabel('Preview')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('setup_accept')
            .setLabel('Accept')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!canAccept),
        new ButtonBuilder()
            .setCustomId('setup_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
    );

    await interaction.update({
        embeds: [getSetupEmbed(setupData)],
        components: [embedButtons, formButtons, formTypeRow, controlButtons]
    });
}

module.exports = {
    handleSetupButton,
    handleSetupModal,
    handleFormTypeSelect,
    showPublicChannelModal,
    showTextModal,
    showColorModal,
    showThumbnailModal,
    showFieldModal,
    showButtonCustomizationModal,
    showChannelModal,
    showPreview,
    saveForm,
    getSetupEmbed,
    setupCache
}; 