# Mail jobs never log their arguments (AC-10.6). Tokens are not passed through jobs
# anyway (AccountTokenEmailJob, AccountMailer#email_changed_notice); this is a second guard.
Rails.application.config.after_initialize do
  ActionMailer::MailDeliveryJob.log_arguments = false
end
