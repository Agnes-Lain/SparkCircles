require "rails_helper"

# letter_opener_web shows every development email (with its one-time links) to anyone who
# can reach the server, so it must never exist outside development.
RSpec.describe "Development email viewer (letter_opener_web)", type: :request do
  it "is not reachable in the test environment" do
    get "/letter_opener"

    expect(response).to have_http_status(:not_found)
  end

  it "is not mounted outside development" do
    expect { Rails.application.routes.recognize_path("/letter_opener") }
      .to raise_error(ActionController::RoutingError)
  end

  it "is a development-only gem, so production (BUNDLE_WITHOUT=development) never installs it" do
    dependency = Bundler.definition.dependencies.find { |dep| dep.name == "letter_opener_web" }

    expect(dependency.groups).to eq([ :development ])
    expect(defined?(LetterOpenerWeb)).to be_nil
    expect(File.read(Rails.root.join("Dockerfile"))).to include('BUNDLE_WITHOUT="development"')
  end

  it "is not the delivery method in test or production" do
    expect(ActionMailer::Base.delivery_method).to eq(:test)
    expect(File.read(Rails.root.join("config/environments/production.rb"))).not_to include("letter_opener")
  end
end
