-- Allow household members to delete events so Erledigt can be undone.
-- The events table is otherwise insert-only per the initial schema,
-- but in-app reset requires local + remote delete.
CREATE POLICY "members delete events" ON events
  FOR DELETE USING (is_household_member(household_id));
