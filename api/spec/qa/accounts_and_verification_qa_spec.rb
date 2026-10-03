require "rails_helper"

# QA additions for PR #2 (accounts-and-verification). See docs/qa/accounts-and-verification.md.
# Examples marked `pending` reproduce a reported bug: they fail today (reported as pending) and
# RSpec will flag them as "fixed" once the bug is corrected, so the `pending` line can be removed.
RSpec.describe "QA: accounts and verification", type: :request do
  let(:password) { strong_test_password }

  describe "AC-10.1 AC-10.2 encryption actually applied in the database and storage" do
    it "stores no sensitive value of verifications, email changes, pending emails or audit IPs in plain text" do
      user = create(:user, email: "claire@example.com", unconfirmed_email: "claire.new@example.com")
      verification = create(:verification, :rejected, user: user, note: "Blurry selfie near Croix-Rousse",
                                                       document_expires_on: Date.new(2031, 7, 14))
      create(:email_change, user: user, previous_email: "old.address@example.com", new_email: "claire@example.com")
      AuditEvent.record!(action: "qa", subject: user, ip_address: "203.0.113.77")
      admin = create(:user, :admin)

      dump = %w[users verifications email_changes audit_events].map do |table|
        ApplicationRecord.connection.select_values("SELECT row_to_json(t)::text FROM #{table} t").join
      end.join
      expect(dump).not_to include("claire@example.com", "claire.new@example.com", "old.address@example.com",
                                  "Croix-Rousse", "2031-07-14", "203.0.113.77", admin.otp_secret)

      blob = verification.document_front.blob
      stored = ActiveStorage::Blob.service.download(blob.key)
      expect(stored.b).not_to start_with("\xFF\xD8\xFF".b)
      expect(stored.b).not_to include(file_fixture("photo.jpg").binread.b[20, 64])
      expect(blob.filename.to_s).to eq("document-front.bin")
      expect(blob.content_type).to eq("application/octet-stream")
    end
  end

  describe "authentication and tokens" do
    it "AC-3.3 keeps refusing the right password during the 15-minute lock, then lets it in" do
      user = create(:user, email: "lock@example.com")
      5.times { post "/api/v1/sessions", params: { email: "lock@example.com", password: wrong_test_password }, as: :json }

      post "/api/v1/sessions", params: { email: "lock@example.com", password: password }, as: :json
      expect(response).to have_http_status(:locked)
      expect(error_code).to eq("account_locked")

      travel 16.minutes do
        post "/api/v1/sessions", params: { email: "lock@example.com", password: password }, as: :json
        expect(response).to have_http_status(:created)
      end
      expect(user.reload.failed_attempts).to eq(0)
    end

    it "AC-11.2 AC-11.4 a token of a closed then erased account never works again" do
      user = create(:user)
      headers = auth_headers(user)
      post "/api/v1/closure", params: { current_password: password }, headers: headers, as: :json
      expect(response).to have_http_status(:accepted)

      get "/api/v1/me", headers: headers
      expect(response).to have_http_status(:unauthorized)
      expect(json).to eq("error" => { "code" => "unauthorized", "message" => I18n.t("api.errors.unauthorized", locale: :fr) })
    end

    it "AC-11.3 a closed account that logs in again is limited by the closure_pending gate" do
      user = create(:user, :closed)
      other = create(:user)
      post "/api/v1/sessions", params: { email: user.email, password: password }, as: :json
      headers = { "Authorization" => "Bearer #{json['token']}" }

      get "/api/v1/users/#{other.id}", headers: headers
      expect(response).to have_http_status(:forbidden)
      expect(error_code).to eq("closure_pending")
      post "/api/v1/verification", headers: headers
      expect(error_code).to eq("closure_pending")
    end
  end

  describe "error format and mass assignment" do
    it "answers 400 bad_request and 404 not_found with the contract's error shape" do
      headers = auth_headers(create(:user))

      post "/api/v1/sessions", params: { password: "x" }, as: :json
      expect(response).to have_http_status(:bad_request)
      expect(json["error"].keys).to contain_exactly("code", "message")

      get "/api/v1/users/not-a-uuid", headers: headers
      expect(response).to have_http_status(:not_found)
      expect(error_code).to eq("not_found")
    end

    it "AC-1.5 ignores roles, verification status and confirmation sent at sign-up" do
      post "/api/v1/registrations", params: { user: {
        first_name: "Eve", last_name: "Hacker", email: "eve@example.com", password: new_test_password,
        adult_confirmed: true, terms_accepted: true, roles: [ "admin" ], verification_status: "verified",
        confirmed_at: Time.current, verification_expires_on: "2030-01-01"
      } }, as: :json

      user = User.find_by(email: "eve@example.com")
      expect(user.role_names).to eq([ "parent" ])
      expect(user).to have_attributes(verification_status: "not_verified", confirmed_at: nil, verification_expires_on: nil)
    end

    it "ignores verification and role fields sent to PATCH /me" do
      user = create(:user)
      patch "/api/v1/me", params: { user: { first_name: "Claire", verification_status: "verified",
                                             verification_expires_on: "2030-01-01", roles: [ "admin" ] } },
                          headers: auth_headers(user), as: :json

      expect(user.reload).to have_attributes(verification_status: "not_verified", verification_expires_on: nil)
      expect(user.role_names).to eq([ "parent" ])
    end
  end

  describe "authorization" do
    it "AC-12.2 another member's token never downloads someone else's data copy" do
      owner = create(:user)
      export = owner.data_exports.create!(requested_at: 1.hour.ago)
      BuildDataExportJob.perform_now(export)

      get "/api/v1/data_export/download", headers: auth_headers(create(:user))
      expect(response).to have_http_status(:not_found)
    end

    it "AC-9.4 AC-9.7 refuses a mobile token on every admin route, even an admin's" do
      admin = create(:user, :admin)
      headers = auth_headers(admin)
      verification = create(:verification, user: create(:user))

      [ [ :get, "/admin" ], [ :get, "/admin/verifications/#{verification.id}" ],
        [ :get, "/admin/verifications/#{verification.id}/files/selfie" ],
        [ :post, "/admin/verifications/#{verification.id}/approve" ], [ :get, "/admin/members" ] ].each do |verb, path|
        public_send(verb, path, headers: headers)
        expect(response).to have_http_status(:forbidden), "#{verb} #{path}"
      end
    end

    it "AC-9.4 a parent with the right password never reaches the second factor or any admin page" do
      parent = create(:user)
      post "/admin/login", params: { email: parent.email, password: password }
      get "/admin/login/code"
      expect(response).to redirect_to("/admin/login")
      get "/admin/members"
      expect(response).to redirect_to("/admin/login")
    end

    it "AC-9.3 refuses a direct approve or file request on the admin's own verification" do
      admin = create(:user, :admin, verification_status: "pending")
      own = create(:verification, user: admin)
      admin_log_in(admin)

      post "/admin/verifications/#{own.id}/approve", params: { document_expires_on: 3.years.from_now.to_date.iso8601 }
      expect(response).to have_http_status(:forbidden)
      get "/admin/verifications/#{own.id}/files/selfie"
      expect(response).to have_http_status(:forbidden)
      expect(own.reload).to be_pending
      expect(admin.reload.verification_status).to eq("pending")
    end

    it "AC-10.4 the image grant of one review never opens another member's images" do
      admin = create(:user, :admin)
      first = create(:verification, user: create(:user))
      second = create(:verification, user: create(:user))
      admin_log_in(admin)

      get "/admin/verifications/#{first.id}"
      get "/admin/verifications/#{second.id}/files/document_front"
      expect(response).to have_http_status(:forbidden)
    end

    it "AC-9.6 a removed admin loses the back office at their next click, with the same session" do
      admin = create(:user, :admin)
      other_admin = create(:user, :admin)
      admin_log_in(admin)
      get "/admin/verifications"
      expect(response).to have_http_status(:ok)

      Admin::MemberActions.new(admin: other_admin).remove_admin!(admin)
      get "/admin/verifications"
      expect(response).to redirect_to("/admin/login")
    end

    it "escapes member-controlled names in the back office" do
      admin = create(:user, :admin)
      create(:verification, user: create(:user, first_name: "<script>alert(1)</script>"))
      admin_log_in(admin)

      get "/admin/verifications"
      expect(response.body).not_to include("<script>alert(1)</script>")
      expect(response.body).to include("&lt;script&gt;")
    end
  end

  describe "AC-11.4 AC-11.6 erasure leaves nothing behind" do
    it "removes every row and file of the account after the grace period" do
      user = create(:user, email: "gone@example.com", closed_at: 31.days.ago, created_at: Date.new(2026, 3, 10))
      create(:verification, :approved, user: user)
      create(:email_change, user: user)
      user.issue_token!(device_name: "phone")
      export = user.data_exports.create!(requested_at: 1.hour.ago)
      BuildDataExportJob.perform_now(export)
      blobs_before = ActiveStorage::Blob.count
      expect(blobs_before).to eq(4)

      EraseClosedAccountsJob.perform_now

      expect(ActiveStorage::Blob.count).to eq(0)
      expect(ActiveStorage::Attachment.count).to eq(0)
      tables = ApplicationRecord.connection.tables - %w[audit_events schema_migrations ar_internal_metadata]
      leftovers = tables.select do |table|
        ApplicationRecord.connection.select_values("SELECT row_to_json(t)::text FROM #{table} t").join.include?(user.id)
      end
      expect(leftovers).to be_empty
      expect(User.find_by(email: "gone@example.com")).to be_nil
    end

    it "AC-11.6 the statistic row does not reveal the exact day of erasure (months only)" do
      create(:user, closed_at: 31.days.ago)
      EraseClosedAccountsJob.perform_now

      stat_id = ClosedAccountStatistic.last.id
      created_ms = stat_id.delete("-")[0, 12].to_i(16)
      expect(Time.zone.at(created_ms / 1000.0)).not_to be_within(1.minute).of(Time.current)
    end
  end

  describe "AC-7.10 ID file retention" do
    it "keeps files of a pending verification and of decisions under 30 days, purges older decisions" do
      pending_one = create(:verification, user: create(:user))
      recent = create(:verification, :approved, user: create(:user), decided_at: 29.days.ago)
      old = create(:verification, :rejected, user: create(:user), decided_at: 31.days.ago)

      PurgeVerificationFilesJob.perform_now

      expect(pending_one.reload.selfie).to be_attached
      expect(recent.reload.selfie).to be_attached
      expect(old.reload.selfie).not_to be_attached
      expect(old.document_front).not_to be_attached
      expect(old).to have_attributes(status: "rejected", document_type: "national_id_card")
      expect(old.files_purged_at).to be_present
    end
  end

  describe "bugs found by QA" do
    it "BUG-01 AC-9.5: the wrong-code limit can't be bypassed by replaying the session cookie" do
      admin = create(:user, :admin)
      post "/admin/login", params: { email: admin.email, password: password }
      fresh_cookie = cookies["_sparkcircles_admin"]

      wrong = (admin.current_otp.to_i + 1).to_s.rjust(6, "0")[-6, 6]
      12.times do
        cookies["_sparkcircles_admin"] = fresh_cookie
        post "/admin/login/code", params: { code: wrong }
      end
      # After more than 5 wrong codes the pending login must be gone...
      expect(response).to redirect_to("/admin/login")
      # ...and a right code sent with the replayed cookie must not log in.
      cookies["_sparkcircles_admin"] = fresh_cookie
      post "/admin/login/code", params: { code: admin.reload.current_otp }
      expect(response).not_to redirect_to("/admin")
    end

    it "BUG-02 AC-13.8: after an email restore, the password the attacker knows no longer works" do
      admin = create(:user, :admin)
      member = create(:user, email: "attacker@example.com", security_locked_at: Time.current)
      report = create(:email_change, user: member, previous_email: "victim@example.com", new_email: "attacker@example.com",
                                     reported_at: Time.current)
      Admin::MemberActions.new(admin: admin).restore_email!(report)

      post "/api/v1/sessions", params: { email: "victim@example.com", password: password }, as: :json
      expect(response).not_to have_http_status(:created)
    end

    it "BUG-03 AC-10.6: one-time link tokens never appear in application logs" do
      # Developer fix round: tokens are no longer passed to jobs (AccountTokenEmailJob creates or
      # reads them when it runs), so this example now takes the token from the email that was sent
      # and checks the logs and the stored job arguments.
      user = create(:user, email: "reset@example.com")
      io = StringIO.new
      previous = ActiveJob::Base.logger
      ActiveJob::Base.logger = ActiveSupport::Logger.new(io).tap { |logger| logger.level = :info }
      begin
        post "/api/v1/password_resets", params: { email: "reset@example.com" }, as: :json
        stored_arguments = enqueued_jobs.map { |job| job["arguments"] }.inspect
        perform_enqueued_jobs
      ensure
        ActiveJob::Base.logger = previous
      end
      raw_token = CGI.unescape(ActionMailer::Base.deliveries.last.text_part.body.to_s[/reset-password\?token=(\S+)/, 1])
      expect(raw_token).to be_present
      expect(user.reload.reset_password_token).not_to eq(raw_token) # stored digested in the users table
      expect(io.string).not_to include(raw_token)
      expect(stored_arguments).not_to include(raw_token)
    end

    it "AC-7.15 (new requirement, not implemented yet): a verified parent who renews early keeps their badge" do
      parent = create(:user, :verified, verification_expires_on: 20.days.from_now.to_date)
      create(:verification, :approved, user: parent, decided_at: 700.days.ago)
      post "/api/v1/verification", params: {
        document_type: "passport", document_front: upload, selfie: upload, date_of_birth: "1990-01-01"
      }, headers: auth_headers(parent)
      expect(response).to have_http_status(:created)

      expect(parent.reload).to be_verified
    end

    it "BUG-04: an admin session cookie stops working after Log out" do
      admin = create(:user, :admin)
      admin_log_in(admin)
      logged_in_cookie = cookies["_sparkcircles_admin"]
      delete "/admin/logout"

      cookies["_sparkcircles_admin"] = logged_in_cookie
      get "/admin/verifications"
      expect(response).to redirect_to("/admin/login")
    end
  end
end
