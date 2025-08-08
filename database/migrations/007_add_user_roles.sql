-- ============================================================================
-- DWAYBANK SMART WALLET - ADD USER ROLES MIGRATION  
-- ============================================================================
-- Migration: 007_add_user_roles
-- Description: Add role-based access control to users table
-- Author: DwayBank Security Team
-- Date: 2025-01-29

-- Create user role enum
CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin', 'support', 'auditor');

-- Add role column to users table
ALTER TABLE users 
ADD COLUMN role user_role NOT NULL DEFAULT 'user';

-- Create index for role-based queries
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;

-- Create composite index for admin operations
CREATE INDEX idx_users_admin_ops ON users(role, status, created_at) 
WHERE role IN ('admin', 'super_admin') AND deleted_at IS NULL;

-- Add constraint to ensure at least one super admin exists
CREATE OR REPLACE FUNCTION ensure_super_admin_exists()
RETURNS TRIGGER AS $$
BEGIN
    -- If trying to remove the last super admin, prevent it
    IF OLD.role = 'super_admin' AND NEW.role != 'super_admin' THEN
        IF (SELECT COUNT(*) FROM users WHERE role = 'super_admin' AND deleted_at IS NULL AND id != OLD.id) = 0 THEN
            RAISE EXCEPTION 'Cannot remove the last super admin user';
        END IF;
    END IF;
    
    -- If soft deleting a super admin, ensure another exists
    IF OLD.role = 'super_admin' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        IF (SELECT COUNT(*) FROM users WHERE role = 'super_admin' AND deleted_at IS NULL AND id != OLD.id) = 0 THEN
            RAISE EXCEPTION 'Cannot delete the last super admin user';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_super_admin_trigger
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION ensure_super_admin_exists();

-- Create function to check user permissions
CREATE OR REPLACE FUNCTION user_has_permission(user_id UUID, required_role user_role)
RETURNS BOOLEAN AS $$
DECLARE
    user_role_level INTEGER;
    required_role_level INTEGER;
    user_record RECORD;
BEGIN
    -- Get user information
    SELECT role, status, deleted_at 
    INTO user_record
    FROM users 
    WHERE id = user_id;
    
    IF NOT FOUND OR user_record.deleted_at IS NOT NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if user is active
    IF user_record.status != 'active' THEN
        RETURN FALSE;
    END IF;
    
    -- Define role hierarchy levels
    user_role_level := CASE user_record.role
        WHEN 'user' THEN 1
        WHEN 'support' THEN 2
        WHEN 'auditor' THEN 3
        WHEN 'admin' THEN 4
        WHEN 'super_admin' THEN 5
        ELSE 0
    END;
    
    required_role_level := CASE required_role
        WHEN 'user' THEN 1
        WHEN 'support' THEN 2
        WHEN 'auditor' THEN 3
        WHEN 'admin' THEN 4
        WHEN 'super_admin' THEN 5
        ELSE 0
    END;
    
    RETURN user_role_level >= required_role_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log role changes
CREATE OR REPLACE FUNCTION log_role_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Log role changes for audit
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        INSERT INTO audit_log (table_name, operation, record_id, old_values, new_values)
        VALUES (
            'users',
            'ROLE_CHANGE',
            NEW.id,
            jsonb_build_object('role', OLD.role),
            jsonb_build_object(
                'role', NEW.role,
                'changed_by', NEW.updated_by,
                'timestamp', CURRENT_TIMESTAMP
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_role_change_trigger
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_role_change();

-- Insert default super admin if no users exist with admin roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE role IN ('super_admin', 'admin')) THEN
        -- Update the first user to super_admin if exists
        UPDATE users 
        SET role = 'super_admin', updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1);
        
        IF NOT FOUND THEN
            RAISE NOTICE 'No users found to promote to super_admin. Please create an admin user manually.';
        ELSE
            RAISE NOTICE 'First user promoted to super_admin role';
        END IF;
    END IF;
END $$;

-- Create view for user role summary
CREATE VIEW user_role_summary AS
SELECT 
    role,
    COUNT(*) as total_users,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
    COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as non_deleted_users
FROM users 
GROUP BY role;

-- Grant permissions
GRANT SELECT ON user_role_summary TO dwaybank;

-- Add comments for documentation
COMMENT ON COLUMN users.role IS 'User role for access control: user, admin, super_admin, support, auditor';
COMMENT ON TYPE user_role IS 'User role enum with hierarchy: user < support < auditor < admin < super_admin';
COMMENT ON FUNCTION user_has_permission(UUID, user_role) IS 'Check if user has required role or higher';
COMMENT ON VIEW user_role_summary IS 'Summary statistics of users by role';

-- Log migration completion
INSERT INTO audit_log (table_name, operation, record_id, new_values) 
VALUES ('system', 'MIGRATION', uuid_generate_v4(), 
    '{"migration": "007_add_user_roles", "status": "completed"}');

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 007_add_user_roles completed successfully';
    RAISE NOTICE 'Added role-based access control with % role types', 
        (SELECT COUNT(*) FROM unnest(enum_range(NULL::user_role)) AS role);
END $$;