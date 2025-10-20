-- Migration: Add Row Level Security and created_at to time_tracker_running_states
-- Date: 2025-10-20
-- Description: Running Session同期機能のためのRLSポリシーとcreated_atカラムを追加

-- 1. created_atカラムを追加（まだ存在しない場合）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'time_tracker_running_states'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE time_tracker_running_states
        ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();

        -- 既存レコードにはupdated_atと同じ値を設定
        UPDATE time_tracker_running_states
        SET created_at = updated_at
        WHERE created_at IS NULL;
    END IF;
END $$;

-- 2. Row Level Securityを有効化
ALTER TABLE time_tracker_running_states ENABLE ROW LEVEL SECURITY;

-- 3. RLSポリシーの追加（既存ポリシーは削除してから再作成）

-- SELECTポリシー: ユーザーは自分のrunning stateのみ閲覧可能
DROP POLICY IF EXISTS "Users can view their own running state" ON time_tracker_running_states;
CREATE POLICY "Users can view their own running state"
  ON time_tracker_running_states
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERTポリシー: ユーザーは自分のrunning stateのみ作成可能
DROP POLICY IF EXISTS "Users can insert their own running state" ON time_tracker_running_states;
CREATE POLICY "Users can insert their own running state"
  ON time_tracker_running_states
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATEポリシー: ユーザーは自分のrunning stateのみ更新可能
DROP POLICY IF EXISTS "Users can update their own running state" ON time_tracker_running_states;
CREATE POLICY "Users can update their own running state"
  ON time_tracker_running_states
  FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETEポリシー: ユーザーは自分のrunning stateのみ削除可能
DROP POLICY IF EXISTS "Users can delete their own running state" ON time_tracker_running_states;
CREATE POLICY "Users can delete their own running state"
  ON time_tracker_running_states
  FOR DELETE
  USING (auth.uid() = user_id);
