Rails.application.routes.draw do
  # Devise mapping only (models, tokens, warden scope). Our own controllers handle
  # the JSON API and the web back office, so no Devise route is generated.
  devise_for :users, skip: :all

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  get "up" => "rails/health#show", as: :rails_health_check

  # Development emails, readable in a browser on the Mac or the phone. The gem is in the
  # Gemfile's development group only, so test and production never load or mount it.
  mount LetterOpenerWeb::Engine, at: "/letter_opener" if Rails.env.development?

  # Development email links land here and redirect to Expo Go (Dev::OpenAppController).
  get "dev/open-app/*path", to: "dev/open_app#show", format: false if Rails.env.development?

  # JSON API for the mobile app (docs/api/accounts-and-verification.md).
  namespace :api, defaults: { format: :json } do
    namespace :v1 do
      resources :registrations, only: :create

      resources :sessions, only: :create
      delete "sessions/current", to: "sessions#destroy", as: :current_session
      delete "sessions", to: "sessions#destroy_all"

      resources :email_confirmations, only: :create do
        post :resend, on: :collection
      end
      resource :password_resets, only: %i[create update]
      resources :email_change_reports, only: :create
      resource :legal, only: :show, controller: "legal"

      resource :me, only: %i[show update], controller: "me" do
        scope module: :me do
          resource :password, only: :update
          resource :email_change, only: :create
          resource :marketing, only: :update, controller: "marketing"
          resource :terms_acceptance, only: :create
          resource :public_profile, only: :show
          resources :events, only: :index
          # My space agenda (docs/api/my-space.md).
          resource :agenda, only: :show, controller: "agenda"
        end
      end

      resources :users, only: :show
      resource :verification, only: %i[show create]
      resource :closure, only: %i[create destroy]
      resource :data_export, only: %i[show create] do
        get :download
      end

      # Events (docs/api/events.md).
      resource :event_options, only: :show
      resources :events, only: %i[index show create update destroy] do
        member do
          post :publish
          post :cancel
        end
        scope module: :events do
          resource :participation, only: %i[create update destroy] do
            delete :request, action: :withdraw
          end
          # US-17: the host's request list and decisions.
          resources :requests, only: :index do
            post :accept, on: :member
            post :decline, on: :member
            post :accept_all, on: :collection
          end
          resources :reports, only: :create
        end
      end

      # Circles (docs/api/circles.md).
      resources :circles, only: %i[index show create update destroy] do
        collection { get :search }
        member { get :activity }
        scope module: :circles do
          resource :invitation, only: %i[show create update]
          resource :join_request, only: %i[create destroy]
          resources :requests, only: [] do
            member do
              post :accept
              post :decline
            end
          end
          resource :membership, only: :destroy do
            post :step_down
          end
          resources :members, only: :destroy do
            post :promote, on: :member
          end
          resources :reports, only: :create
        end
      end
      resources :circle_invitations, only: [] do
        collection do
          post :preview
          post :join
        end
      end
      resources :circle_cards, only: [] do
        post :dismiss, on: :member
      end
    end
  end

  # Web back office for admins (AC-9.7): cookie session, CSRF, second factor.
  namespace :admin do
    root "verifications#index"

    get "login", to: "sessions#new", as: :login
    post "login", to: "sessions#create"
    get "login/code", to: "two_factor#new", as: :two_factor
    post "login/code", to: "two_factor#create"
    get "login/setup", to: "two_factor_setups#new", as: :two_factor_setup
    post "login/setup", to: "two_factor_setups#create"
    delete "logout", to: "sessions#destroy", as: :logout

    resources :verifications, only: %i[index show] do
      member do
        post :approve
        post :reject
        get "files/:file", to: "verification_files#show", as: :file, constraints: { file: /document_front|document_back|selfie/ }
      end
    end

    resources :events, only: %i[index show] do
      member do
        post :remove_tag
        post :suspend
        post :cancel
        post :resolve_reports
      end
    end

    resources :circles, only: %i[index show] do
      member do
        post :suspend
        post :resume
        post :force_private
        post :lift_private
        post :resolve_reports
      end
    end

    resources :members, only: %i[index show] do
      # POST so the searched email never appears in a URL (AC-10.6).
      post :search, on: :collection
      member do
        post :revoke_verification
        post :grant_admin
        post :remove_admin
        post :restore_email
        post :close_report
      end
    end
  end
end
