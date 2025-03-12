const { ButtonBuilder, ActionRowBuilder, EmbedBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../database/init');
const yaml = require('js-yaml');
const fs = require('fs');
const { hasPermission } = require('../handlers/permissionHandler');
const { 
    handleSetupButton, 
    handleSetupModal, 
    handleFormTypeSelect, 
} = require('../handlers/setupHandler');

const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        try {
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (!command) return;

                try {
                    await command.execute(interaction);
                } catch (error) {
                    console.error('Error executing command:', error);
                    await interaction.reply({ 
                        content: 'There was an error executing this command!', 
                        ephemeral: true 
                    });
                }
                return;
            }

            if (interaction.isButton() && interaction.customId.startsWith('setup_')) {
                try {
                    await handleSetupButton(interaction);
                } catch (error) {
                    console.error('Error handling setup button:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'Une erreur s\'est produite lors du traitement de votre demande. Veuillez réessayer.',
                            ephemeral: true
                        });
                    }
                }
                return;
            }

            if (interaction.isModalSubmit() && interaction.customId.startsWith('setup_modal_')) {
                await handleSetupModal(interaction);
                return;
            }

            if (interaction.isStringSelectMenu() && interaction.customId === 'setup_form_type') {
                await handleFormTypeSelect(interaction);
                return;
            }

            if (interaction.isButton() && interaction.customId.startsWith('openForm_')) {
                if (!hasPermission(interaction.member, 'form_submission')) {
                    return interaction.reply({
                        content: 'Vous n\'êtes pas autorisé à soumettre des formulaires. Les rôles requis sont manquants.',
                        ephemeral: true
                    });
                }

                const formId = interaction.customId.split('_')[1];
                
                db.get(`SELECT * FROM form_templates WHERE id = ?`, [formId], async (err, template) => {
                    if (err || !template) {
                        return interaction.reply({ 
                            content: 'Erreur lors du chargement du modèle de formulaire.', 
                            ephemeral: true 
                        });
                    }

                    const formData = JSON.parse(template.fields);
                    const modal = new ModalBuilder()
                        .setCustomId(`submitForm_${formId}`)
                        .setTitle(formData.embed.title);

                    formData.fields.forEach((field, index) => {
                        const input = new TextInputBuilder()
                            .setCustomId(`field_${index}`)
                            .setLabel(truncateText(field.label, 45))
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(field.required)
                            .setMaxLength(1024);

                        if (field.placeholder) {
                            input.setPlaceholder(truncateText(field.placeholder, 100));
                        }

                        modal.addComponents(new ActionRowBuilder().addComponents(input));
                    });

                    await interaction.showModal(modal);
                });
            }

            if (interaction.isModalSubmit() && interaction.customId.startsWith('submitForm_')) {
                const formId = interaction.customId.split('_')[1];
                
                db.get(`SELECT * FROM form_templates WHERE id = ?`, [formId], async (err, template) => {
                    if (err || !template) {
                        return interaction.reply({ 
                            content: 'Erreur lors du chargement du modèle de formulaire.', 
                            ephemeral: true 
                        });
                    }

                    const formData = JSON.parse(template.fields);
                    const responses = {};
                    
                    formData.fields.forEach((field, index) => {
                        const response = interaction.fields.getTextInputValue(`field_${index}`);
                        if (response.trim() || field.required) {
                            responses[field.label] = response.trim() || 'No response provided';
                        }
                    });

                    db.run(
                        `INSERT INTO submitted_forms (template_id, user_id, responses) VALUES (?, ?, ?)`,
                        [formId, interaction.user.id, JSON.stringify(responses)],
                        async function(err) {
                            if (err) {
                                console.error('Erreur lors de l\'enregistrement de la soumission du formulaire:', err);
                                return interaction.reply({ 
                                    content: 'Erreur lors de l\'envoi du formulaire.', 
                                    ephemeral: true 
                                });
                            }

                            const responseEmbed = new EmbedBuilder()
                                .setTitle(truncateText(`Nouvelle soumission: ${formData.embed.title}`, 256))
                                .setDescription(truncateText(`Soumis par <@${interaction.user.id}> (${interaction.user.tag})`, 4096))
                                .setColor(formData.embed.color)
                                .setTimestamp();

                            Object.entries(responses).forEach(([field, value]) => {
                                const displayValue = value.trim() || 'Aucune réponse fournie';
                                responseEmbed.addFields({ 
                                    name: truncateText(field, 256), 
                                    value: truncateText(displayValue, 1024),
                                    inline: false
                                });
                            });

                            const approvalRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`approve_${this.lastID}`)
                                    .setLabel('Approuvé')
                                    .setStyle(ButtonStyle.Success),
                                new ButtonBuilder()
                                    .setCustomId(`deny_${this.lastID}`)
                                    .setLabel('Refusé')
                                    .setStyle(ButtonStyle.Danger)
                            );

                            const channel = await interaction.guild.channels.fetch(template.response_channel_id);
                            await channel.send({
                                embeds: [responseEmbed],
                                components: [approvalRow]
                            });

                            await interaction.reply({ 
                                content: 'Formulaire soumis avec succès!', 
                                ephemeral: true 
                            });
                        }
                    );
                });
            }

            if (interaction.isButton() && (interaction.customId.startsWith('approve_') || interaction.customId.startsWith('deny_'))) {
                if (!hasPermission(interaction.member, 'form_approval')) {
                    return interaction.reply({
                        content: 'Vous n\'avez pas la permission d\'approuver/refuser des formulaires.',
                        ephemeral: true
                    });
                }

                const submissionId = interaction.customId.split('_')[1];
                const action = interaction.customId.startsWith('approve_') ? 'approve' : 'deny';

                const modal = new ModalBuilder()
                    .setCustomId(`${action}_modal_${submissionId}`)
                    .setTitle(`${action.charAt(0).toUpperCase() + action.slice(1)} Form`);

                const reasonInput = new TextInputBuilder()
                    .setCustomId('reason')
                    .setLabel(`Reason for ${action}ing`)
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(1024);

                modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
                await interaction.showModal(modal);
                return;
            }

            if (interaction.isModalSubmit() && (interaction.customId.startsWith('approve_modal_') || interaction.customId.startsWith('deny_modal_'))) {
                const [action, , submissionId] = interaction.customId.split('_');
                const reason = interaction.fields.getTextInputValue('reason');

                db.get(
                    `SELECT s.*, t.form_type, t.public_channel_id, t.fields as template_fields 
                    FROM submitted_forms s 
                    JOIN form_templates t ON s.template_id = t.id 
                    WHERE s.id = ?`, 
                    [submissionId],
                    async (err, submission) => {
                        if (err || !submission) {
                            return interaction.reply({
                                content: 'Erreur lors du chargement de la soumission.',
                                ephemeral: true
                            });
                        }

                        const formData = JSON.parse(submission.template_fields);
                        const responses = JSON.parse(submission.responses);

                        db.run(
                            `UPDATE submitted_forms SET status = ?, response_reason = ?, responded_by = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?`,
                            [action, reason, interaction.user.id, submissionId],
                            async function(err) {
                                if (err) {
                                    console.error('Erreur lors de la mise à jour de la soumission:', err);
                                    return interaction.reply({
                                        content: 'Erreur lors de la mise à jour de la soumission.',
                                        ephemeral: true
                                    });
                                }

                                const message = interaction.message;

                                const responseEmbed = EmbedBuilder.from(message.embeds[0])
                                    .setColor(action === 'approve' ? '#00FF00' : '#FF0000')
                                    .addFields({
                                        name: `Submission ${action === 'approve' ? 'Approved' : 'Denied'}`,
                                        value: `Reason: ${reason}\nBy: <@${interaction.user.id}> (${interaction.user.tag})`,
                                        inline: false
                                    });

                                await message.edit({
                                    embeds: [responseEmbed],
                                    components: []
                                });

                                if (action === 'approve' && submission.public_channel_id) {
                                    const publicChannel = await interaction.guild.channels.fetch(submission.public_channel_id);
                                    if (publicChannel) {
                                        const publicEmbed = new EmbedBuilder()
                                            .setTitle(formData.embed.title)
                                            .setColor(formData.embed.color)
                                            .setTimestamp();

                                        publicEmbed
                                            .setDescription(`Soumis par <@${interaction.user.id}> (${interaction.user.tag})`)
                                            .addFields(
                                                Object.entries(responses).map(([field, value]) => ({
                                                    name: field,
                                                    value: value,
                                                    inline: false
                                                }))
                                            );

                                        const components = [];
                                        if (submission.form_type === 'suggestion') {
                                            const voteRow = new ActionRowBuilder().addComponents(
                                                new ButtonBuilder()
                                                    .setCustomId(`upvote_${submissionId}`)
                                                    .setLabel('👍 0')
                                                    .setStyle(ButtonStyle.Secondary),
                                                new ButtonBuilder()
                                                    .setCustomId(`downvote_${submissionId}`)
                                                    .setLabel('👎 0')
                                                    .setStyle(ButtonStyle.Secondary)
                                            );
                                            components.push(voteRow);
                                        }

                                        const publicMessage = await publicChannel.send({
                                            embeds: [publicEmbed],
                                            components: components
                                        });

                                        db.run(
                                            'UPDATE submitted_forms SET public_message_id = ? WHERE id = ?',
                                            [publicMessage.id, submissionId]
                                        );
                                    }
                                }

                                if (config.send_dm_to_submitter) {
                                    try {
                                        const submitter = await interaction.guild.members.fetch(submission.user_id);
                                        const notificationEmbed = new EmbedBuilder()
                                            .setTitle(`Formulaire ${action === 'approve' ? 'Approuvé' : 'Refuser'}`)
                                            .setDescription(`Votre soumission de formulaire a été ${action === 'approve' ? 'Approuvé' : 'Refuser'}.`)
                                            .setColor(action === 'approve' ? '#00FF00' : '#FF0000')
                                            .addFields(
                                                { name: 'Reason', value: reason }
                                            )
                                            .setTimestamp();
    
                                        await submitter.send({ embeds: [notificationEmbed] });
                                    } catch (error) {
                                        console.error('Impossible de notifier l\'utilisateur:', error);
                                    }
                                }

                                await interaction.reply({
                                    content: `Soumission du formulaire réussie ${action === 'approve' ? 'Approuvé' : 'Refuser'}`,
                                    ephemeral: true
                                });
                            }
                        );
                    }
                );
                return;
            }

            if (interaction.isButton() && (interaction.customId.startsWith('upvote_') || interaction.customId.startsWith('downvote_'))) {
                const [action, submissionId] = interaction.customId.split('_');
                const isUpvote = action === 'upvote';

                db.get(
                    'SELECT vote_type FROM form_votes WHERE submission_id = ? AND user_id = ?',
                    [submissionId, interaction.user.id],
                    async (err, existingVote) => {
                        if (err) {
                            return interaction.reply({
                                content: 'Erreur lors de la vérification du statut du vote.',
                                ephemeral: true
                            });
                        }

                        if (existingVote) {
                            return interaction.reply({
                                content: 'Vous avez déjà voté pour cette soumission.',
                                ephemeral: true
                            });
                        }

                        db.serialize(() => {
                            db.run(
                                `UPDATE submitted_forms SET ${isUpvote ? 'upvotes' : 'downvotes'} = ${isUpvote ? 'upvotes' : 'downvotes'} + 1 WHERE id = ?`,
                                [submissionId]
                            );
                            db.run(
                                'INSERT INTO form_votes (submission_id, user_id, vote_type) VALUES (?, ?, ?)',
                                [submissionId, interaction.user.id, isUpvote ? 'upvote' : 'downvote']
                            );
                            db.get(
                                'SELECT upvotes, downvotes FROM submitted_forms WHERE id = ?',
                                [submissionId],
                                async (err, result) => {
                                    if (err || !result) {
                                        return interaction.reply({
                                            content: 'Erreur lors de la récupération du nombre de votes.',
                                            ephemeral: true
                                        });
                                    }

                                    const voteRow = new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                            .setCustomId(`upvote_${submissionId}`)
                                            .setLabel(`👍 ${result.upvotes}`)
                                            .setStyle(ButtonStyle.Secondary),
                                        new ButtonBuilder()
                                            .setCustomId(`downvote_${submissionId}`)
                                            .setLabel(`👎 ${result.downvotes}`)
                                            .setStyle(ButtonStyle.Secondary)
                                    );

                                    await interaction.message.edit({
                                        embeds: interaction.message.embeds,
                                        components: [voteRow]
                                    });

                                    await interaction.reply({
                                        content: `Votre vote a été enregistré !`,
                                        ephemeral: true
                                    });
                                }
                            );
                        });
                    }
                );
                return;
            }
        } catch (error) {
            console.error('Erreur dans le gestionnaire d\'interaction:', error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'Une erreur s\'est produite lors du traitement de votre interaction!',
                        ephemeral: true
                    });
                }
            } catch (err) {
                console.error('Erreur dans le gestionnaire d\'interaction:', err);
            }
        }
    },
}; 
