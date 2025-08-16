// Intentionally left blank.
// Previously this file declared `declare module '@supabase/supabase-js';`
// which shadowed the official type definitions from the package and caused
// TypeScript errors like: "Cannot use namespace 'SupabaseClient' as a type."
// By removing that ambient declaration, we allow TypeScript to use the
// real type definitions bundled with '@supabase/supabase-js'.
