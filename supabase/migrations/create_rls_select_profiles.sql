CREATE POLICY "Users can view their own profile."
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);