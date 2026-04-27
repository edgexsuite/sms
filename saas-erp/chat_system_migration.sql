-- Chat System Schema
-- Implementation for Parent-Teacher-Student Chat

-- 1. Create the chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('staff', 'parent', 'student')),
    receiver_id UUID NOT NULL,
    receiver_type TEXT NOT NULL CHECK (receiver_type IN ('staff', 'parent', 'student')),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add indexing for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_school_id ON chat_messages(school_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_student_id ON chat_messages(student_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver_id ON chat_messages(receiver_id);

-- 3. Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies

-- Policy for Staff/Teachers: Can see messages in their school
CREATE POLICY chat_staff_policy ON chat_messages
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff 
            WHERE staff.id = auth.uid() OR staff.email = auth.jwt()->>'email'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM staff 
            WHERE staff.id = auth.uid() OR staff.email = auth.jwt()->>'email'
        )
    );

-- Policy for Parents: Can see messages related to their children
CREATE POLICY chat_parent_policy ON chat_messages
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM students 
            WHERE students.id = chat_messages.student_id 
            AND students.parent_id = auth.uid()
        )
    );

-- 5. Enable Realtime
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
        EXCEPTION WHEN OTHERS THEN
            -- Table might already be in publication
        END;
    END IF;
END $$;
