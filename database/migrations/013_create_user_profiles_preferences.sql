-- Migration: Create User Profiles and Preferences Tables
-- Description: Comprehensive user profile management and preferences system for DwayBank

BEGIN;

-- Create profile completion status enum
CREATE TYPE profile_completion_status AS ENUM (
    'incomplete',
    'basic_complete',
    'full_complete',
    'verified'
);

-- Create notification preference type enum
CREATE TYPE notification_type AS ENUM (
    'email',
    'sms', 
    'push',
    'in_app'
);

-- Create theme preference enum
CREATE TYPE theme_preference AS ENUM (
    'light',
    'dark',
    'system'
);

-- Create language preference enum (ISO 639-1 codes)
CREATE TYPE language_code AS ENUM (
    'en',    -- English
    'es',    -- Spanish
    'fr',    -- French
    'de',    -- German
    'zh',    -- Chinese
    'ja',    -- Japanese
    'ko',    -- Korean
    'pt',    -- Portuguese
    'it',    -- Italian
    'ru',    -- Russian
    'ar',    -- Arabic
    'hi'     -- Hindi
);

-- Create currency preference enum (ISO 4217 codes)
CREATE TYPE currency_code AS ENUM (
    'USD',   -- US Dollar
    'EUR',   -- Euro
    'GBP',   -- British Pound
    'JPY',   -- Japanese Yen
    'CAD',   -- Canadian Dollar
    'AUD',   -- Australian Dollar
    'CHF',   -- Swiss Franc
    'CNY',   -- Chinese Yuan
    'INR',   -- Indian Rupee
    'BRL',   -- Brazilian Real
    'KRW',   -- South Korean Won
    'MXN',   -- Mexican Peso
    'SGD',   -- Singapore Dollar
    'HKD',   -- Hong Kong Dollar
    'NZD',   -- New Zealand Dollar
    'SEK',   -- Swedish Krona
    'NOK',   -- Norwegian Krone
    'DKK',   -- Danish Krone
    'PLN',   -- Polish Zloty
    'RUB'    -- Russian Ruble
);

-- Main user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    
    -- Personal Information
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(200),
    date_of_birth DATE,
    gender VARCHAR(20), -- 'male', 'female', 'non-binary', 'prefer-not-to-say', 'other'
    
    -- Contact Information
    phone_number VARCHAR(20),
    phone_verified BOOLEAN DEFAULT false,
    phone_verified_at TIMESTAMP,
    secondary_email VARCHAR(255),
    secondary_email_verified BOOLEAN DEFAULT false,
    secondary_email_verified_at TIMESTAMP,
    
    -- Address Information
    street_address TEXT,
    street_address_2 TEXT, -- Apartment, suite, unit, etc.
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country_code CHAR(2), -- ISO 3166-1 alpha-2
    
    -- Professional Information
    occupation VARCHAR(200),
    employer VARCHAR(200),
    annual_income_range VARCHAR(50), -- '0-25k', '25k-50k', '50k-100k', '100k-250k', '250k+'
    
    -- Profile Management
    profile_picture_url TEXT,
    bio TEXT,
    completion_status profile_completion_status DEFAULT 'incomplete',
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    
    -- Privacy Settings
    profile_visibility VARCHAR(20) DEFAULT 'private', -- 'public', 'private', 'contacts_only'
    allow_search BOOLEAN DEFAULT false,
    show_online_status BOOLEAN DEFAULT true,
    
    -- Timestamps and Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_profile_update TIMESTAMP,
    profile_views INTEGER DEFAULT 0,
    
    -- Data Protection
    data_retention_consent BOOLEAN DEFAULT true,
    marketing_consent BOOLEAN DEFAULT false,
    analytics_consent BOOLEAN DEFAULT true,
    
    -- Foreign key constraint
    CONSTRAINT fk_user_profiles_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    
    -- Localization Preferences
    language language_code DEFAULT 'en',
    country_code CHAR(2), -- ISO 3166-1 alpha-2
    timezone VARCHAR(50) DEFAULT 'UTC', -- IANA timezone
    date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY', -- 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'
    time_format VARCHAR(10) DEFAULT '12h', -- '12h', '24h'
    
    -- Currency and Financial Preferences
    primary_currency currency_code DEFAULT 'USD',
    secondary_currency currency_code,
    decimal_places INTEGER DEFAULT 2 CHECK (decimal_places >= 0 AND decimal_places <= 8),
    thousand_separator VARCHAR(5) DEFAULT ',',
    decimal_separator VARCHAR(5) DEFAULT '.',
    currency_symbol_position VARCHAR(10) DEFAULT 'before', -- 'before', 'after'
    
    -- Display Preferences
    theme theme_preference DEFAULT 'system',
    font_size VARCHAR(20) DEFAULT 'medium', -- 'small', 'medium', 'large', 'x-large'
    high_contrast BOOLEAN DEFAULT false,
    reduce_animations BOOLEAN DEFAULT false,
    compact_view BOOLEAN DEFAULT false,
    
    -- Dashboard Preferences
    dashboard_layout JSONB DEFAULT '{"widgets": ["balance", "recent_transactions", "budget_summary"], "columns": 2}',
    default_account_view VARCHAR(50) DEFAULT 'all_accounts',
    transaction_grouping VARCHAR(20) DEFAULT 'date', -- 'date', 'category', 'account'
    chart_type VARCHAR(20) DEFAULT 'line', -- 'line', 'bar', 'pie', 'donut'
    
    -- Security Preferences
    session_timeout_minutes INTEGER DEFAULT 30 CHECK (session_timeout_minutes >= 5 AND session_timeout_minutes <= 480),
    require_mfa_for_sensitive BOOLEAN DEFAULT true,
    logout_on_browser_close BOOLEAN DEFAULT false,
    remember_device_days INTEGER DEFAULT 30 CHECK (remember_device_days >= 0 AND remember_device_days <= 365),
    
    -- Privacy Preferences
    data_sharing_analytics BOOLEAN DEFAULT true,
    data_sharing_marketing BOOLEAN DEFAULT false,
    data_sharing_partners BOOLEAN DEFAULT false,
    activity_tracking BOOLEAN DEFAULT true,
    personalized_ads BOOLEAN DEFAULT false,
    
    -- Communication Preferences
    contact_method_preference VARCHAR(20) DEFAULT 'email', -- 'email', 'sms', 'phone', 'in_app'
    
    -- Backup and Sync
    auto_backup BOOLEAN DEFAULT true,
    sync_across_devices BOOLEAN DEFAULT true,
    offline_access BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_user_preferences_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Notification preferences table (detailed notification settings)
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    notification_type notification_type NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'security', 'transactions', 'account', 'marketing', 'system'
    enabled BOOLEAN DEFAULT true,
    delivery_method JSONB DEFAULT '{"immediate": true, "digest": false, "frequency": "immediate"}',
    quiet_hours JSONB, -- {"start": "22:00", "end": "07:00", "timezone": "UTC"}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_notification_preferences_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    
    -- Unique constraint for user + type + category
    CONSTRAINT uk_notification_preferences 
        UNIQUE (user_id, notification_type, category)
);

-- User profile history table (for audit and change tracking)
CREATE TABLE IF NOT EXISTS user_profile_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    profile_id UUID NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by UUID, -- Could be user_id or admin_id
    change_reason VARCHAR(200),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_profile_history_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_profile_history_profile 
        FOREIGN KEY (profile_id) 
        REFERENCES user_profiles(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_profile_history_changed_by 
        FOREIGN KEY (changed_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL
);

-- User devices table (for device management and preferences)
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    device_id VARCHAR(255) NOT NULL, -- Generated device fingerprint
    device_name VARCHAR(200), -- User-friendly name
    device_type VARCHAR(50), -- 'mobile', 'tablet', 'desktop', 'tv'
    platform VARCHAR(50), -- 'ios', 'android', 'windows', 'macos', 'linux'
    browser VARCHAR(100),
    user_agent TEXT,
    ip_address INET,
    is_trusted BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    push_token TEXT, -- For push notifications
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    location_info JSONB, -- {"country": "US", "region": "CA", "city": "San Francisco"}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_user_devices_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    
    -- Unique constraint for user + device
    CONSTRAINT uk_user_devices 
        UNIQUE (user_id, device_id)
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id 
    ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_completion_status 
    ON user_profiles(completion_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_country 
    ON user_profiles(country_code);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at 
    ON user_profiles(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id 
    ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_language 
    ON user_preferences(language);
CREATE INDEX IF NOT EXISTS idx_user_preferences_currency 
    ON user_preferences(primary_currency);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id 
    ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_type_category 
    ON notification_preferences(notification_type, category);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_enabled 
    ON notification_preferences(enabled) 
    WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_profile_history_user_id 
    ON user_profile_history(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_history_created_at 
    ON user_profile_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_history_field_name 
    ON user_profile_history(field_name);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id 
    ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_active 
    ON user_devices(user_id, is_active) 
    WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_devices_trusted 
    ON user_devices(user_id, is_trusted) 
    WHERE is_trusted = true;
CREATE INDEX IF NOT EXISTS idx_user_devices_last_seen 
    ON user_devices(last_seen_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    IF TG_TABLE_NAME = 'user_profiles' THEN
        NEW.last_profile_update = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_updated_at();

CREATE TRIGGER trigger_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_updated_at();

CREATE TRIGGER trigger_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_updated_at();

CREATE TRIGGER trigger_user_devices_updated_at
    BEFORE UPDATE ON user_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_updated_at();

-- Trigger to create profile history entries
CREATE OR REPLACE FUNCTION create_profile_history_entry()
RETURNS TRIGGER AS $$
DECLARE
    column_record RECORD;
    old_val TEXT;
    new_val TEXT;
BEGIN
    -- Only track changes for user_profiles table updates
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'user_profiles' THEN
        -- Loop through all columns and detect changes
        FOR column_record IN 
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'user_profiles' 
              AND table_schema = 'public'
              AND column_name NOT IN ('id', 'created_at', 'updated_at', 'last_profile_update', 'profile_views')
        LOOP
            -- Get old and new values
            EXECUTE format('SELECT ($1).%I::TEXT', column_record.column_name) INTO old_val USING OLD;
            EXECUTE format('SELECT ($1).%I::TEXT', column_record.column_name) INTO new_val USING NEW;
            
            -- Insert history entry if values are different
            IF old_val IS DISTINCT FROM new_val THEN
                INSERT INTO user_profile_history (
                    user_id,
                    profile_id,
                    field_name,
                    old_value,
                    new_value,
                    changed_by
                ) VALUES (
                    NEW.user_id,
                    NEW.id,
                    column_record.column_name,
                    old_val,
                    new_val,
                    NEW.user_id -- In real implementation, this would come from session context
                );
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profile_history
    AFTER UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_profile_history_entry();

-- Function to calculate profile completion percentage
CREATE OR REPLACE FUNCTION calculate_profile_completion(profile_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    completion_score INTEGER := 0;
    total_fields INTEGER := 20; -- Adjust based on required fields
BEGIN
    SELECT 
        CASE WHEN first_name IS NOT NULL AND first_name != '' THEN 1 ELSE 0 END +
        CASE WHEN last_name IS NOT NULL AND last_name != '' THEN 1 ELSE 0 END +
        CASE WHEN date_of_birth IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN phone_number IS NOT NULL AND phone_number != '' THEN 1 ELSE 0 END +
        CASE WHEN phone_verified = true THEN 1 ELSE 0 END +
        CASE WHEN street_address IS NOT NULL AND street_address != '' THEN 1 ELSE 0 END +
        CASE WHEN city IS NOT NULL AND city != '' THEN 1 ELSE 0 END +
        CASE WHEN state_province IS NOT NULL AND state_province != '' THEN 1 ELSE 0 END +
        CASE WHEN postal_code IS NOT NULL AND postal_code != '' THEN 1 ELSE 0 END +
        CASE WHEN country_code IS NOT NULL AND country_code != '' THEN 1 ELSE 0 END +
        CASE WHEN occupation IS NOT NULL AND occupation != '' THEN 1 ELSE 0 END +
        CASE WHEN annual_income_range IS NOT NULL AND annual_income_range != '' THEN 1 ELSE 0 END +
        CASE WHEN profile_picture_url IS NOT NULL AND profile_picture_url != '' THEN 1 ELSE 0 END +
        CASE WHEN bio IS NOT NULL AND bio != '' THEN 1 ELSE 0 END +
        -- Additional verification checks
        5 * CASE WHEN EXISTS(SELECT 1 FROM kyc_verifications WHERE user_id = profile_user_id AND status = 'approved') THEN 1 ELSE 0 END +
        3 * CASE WHEN EXISTS(SELECT 1 FROM mfa_configs WHERE user_id = profile_user_id AND is_enabled = true) THEN 1 ELSE 0 END
    INTO completion_score
    FROM user_profiles 
    WHERE user_id = profile_user_id;
    
    -- Return percentage (capped at 100)
    RETURN LEAST(100, (completion_score * 100) / total_fields);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update completion percentage and status
CREATE OR REPLACE FUNCTION update_profile_completion()
RETURNS TRIGGER AS $$
DECLARE
    new_percentage INTEGER;
    new_status profile_completion_status;
BEGIN
    -- Calculate completion percentage
    new_percentage := calculate_profile_completion(NEW.user_id);
    
    -- Determine completion status
    IF new_percentage >= 90 THEN
        new_status := 'verified';
    ELSIF new_percentage >= 75 THEN
        new_status := 'full_complete';
    ELSIF new_percentage >= 40 THEN
        new_status := 'basic_complete';
    ELSE
        new_status := 'incomplete';
    END IF;
    
    -- Update the record
    NEW.completion_percentage := new_percentage;
    NEW.completion_status := new_status;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_profile_completion
    BEFORE INSERT OR UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_completion();

-- Row Level Security (RLS) policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- Policy for users to access their own data
CREATE POLICY user_profiles_own_data ON user_profiles
    FOR ALL TO dwaybank_user
    USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY user_preferences_own_data ON user_preferences
    FOR ALL TO dwaybank_user
    USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY notification_preferences_own_data ON notification_preferences
    FOR ALL TO dwaybank_user
    USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY user_profile_history_own_data ON user_profile_history
    FOR SELECT TO dwaybank_user
    USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY user_devices_own_data ON user_devices
    FOR ALL TO dwaybank_user
    USING (user_id = current_setting('app.current_user_id')::uuid);

-- Admin policies
CREATE POLICY user_profiles_admin_policy ON user_profiles
    FOR ALL TO dwaybank_admin
    USING (true);

CREATE POLICY user_preferences_admin_policy ON user_preferences
    FOR ALL TO dwaybank_admin
    USING (true);

CREATE POLICY notification_preferences_admin_policy ON notification_preferences
    FOR ALL TO dwaybank_admin
    USING (true);

CREATE POLICY user_profile_history_admin_policy ON user_profile_history
    FOR ALL TO dwaybank_admin
    USING (true);

CREATE POLICY user_devices_admin_policy ON user_devices
    FOR ALL TO dwaybank_admin
    USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON user_profiles TO dwaybank_user;
GRANT SELECT, INSERT, UPDATE ON user_preferences TO dwaybank_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_preferences TO dwaybank_user;
GRANT SELECT ON user_profile_history TO dwaybank_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_devices TO dwaybank_user;

GRANT ALL ON user_profiles TO dwaybank_admin;
GRANT ALL ON user_preferences TO dwaybank_admin;
GRANT ALL ON notification_preferences TO dwaybank_admin;
GRANT ALL ON user_profile_history TO dwaybank_admin;
GRANT ALL ON user_devices TO dwaybank_admin;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO dwaybank_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO dwaybank_admin;

-- Add table comments for documentation
COMMENT ON TABLE user_profiles IS 'Comprehensive user profile information with privacy controls and completion tracking';
COMMENT ON TABLE user_preferences IS 'User customization preferences for UI, localization, and system behavior';
COMMENT ON TABLE notification_preferences IS 'Granular notification settings by type and category';
COMMENT ON TABLE user_profile_history IS 'Audit trail for all profile changes with change tracking';
COMMENT ON TABLE user_devices IS 'Registered user devices for security and preference synchronization';

-- Add column comments
COMMENT ON COLUMN user_profiles.completion_percentage IS 'Auto-calculated profile completion percentage (0-100)';
COMMENT ON COLUMN user_profiles.completion_status IS 'Profile completion status based on verification and data completeness';
COMMENT ON COLUMN user_preferences.dashboard_layout IS 'JSON configuration for personalized dashboard layout';
COMMENT ON COLUMN user_preferences.session_timeout_minutes IS 'Custom session timeout (5-480 minutes)';
COMMENT ON COLUMN notification_preferences.delivery_method IS 'JSON config for notification delivery timing and frequency';
COMMENT ON COLUMN user_devices.device_id IS 'Generated device fingerprint for identification';
COMMENT ON COLUMN user_devices.is_trusted IS 'Whether device is marked as trusted for reduced security prompts';

COMMIT;