-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Create custom types
create type message_type as enum ('text', 'image');
create type model_type as enum ('gemini-1.0-pro', 'gemini-1.0-pro-vision');

-- Create users table (extends Auth0 user data)
create table public.users (
    id uuid primary key default uuid_generate_v4(),
    auth0_id text unique not null,
    email text unique not null,
    name text,
    picture_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create conversations table
create table public.conversations (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references public.users(id) on delete cascade not null,
    title text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create messages table
create table public.messages (
    id uuid primary key default uuid_generate_v4(),
    conversation_id uuid references public.conversations(id) on delete cascade not null,
    user_id uuid references public.users(id) on delete cascade not null,
    content text not null,
    type message_type not null default 'text',
    model_used model_type,
    image_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create generated_images table
create table public.generated_images (
    id uuid primary key default uuid_generate_v4(),
    message_id uuid references public.messages(id) on delete cascade not null,
    prompt text not null,
    image_url text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for better query performance
create index idx_users_auth0_id on public.users(auth0_id);
create index idx_conversations_user_id on public.conversations(user_id);
create index idx_messages_conversation_id on public.messages(conversation_id);
create index idx_messages_user_id on public.messages(user_id);
create index idx_generated_images_message_id on public.generated_images(message_id);

-- Create updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

-- Add updated_at triggers to tables
create trigger handle_users_updated_at
    before update on public.users
    for each row
    execute function public.handle_updated_at();

create trigger handle_conversations_updated_at
    before update on public.conversations
    for each row
    execute function public.handle_updated_at();

create trigger handle_messages_updated_at
    before update on public.messages
    for each row
    execute function public.handle_updated_at();

-- Create RLS (Row Level Security) policies
alter table public.users enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.generated_images enable row level security;

-- Users policies
create policy "Users can view their own data"
    on public.users for select
    using (auth0_id = auth.uid()::text);

create policy "Users can update their own data"
    on public.users for update
    using (auth0_id = auth.uid()::text);

-- Add policy to allow service role to insert users
create policy "Service role can insert users"
    on public.users for insert
    with check (auth.role() = 'service_role');

-- Conversations policies
create policy "Users can view their own conversations"
    on public.conversations for select
    using (exists (
        select 1 from public.users
        where users.id = conversations.user_id
        and users.auth0_id = auth.uid()::text
    ));

create policy "Users can create their own conversations"
    on public.conversations for insert
    with check (exists (
        select 1 from public.users
        where users.id = user_id
        and users.auth0_id = auth.uid()::text
    ));

create policy "Users can update their own conversations"
    on public.conversations for update
    using (exists (
        select 1 from public.users
        where users.id = conversations.user_id
        and users.auth0_id = auth.uid()::text
    ));

create policy "Users can delete their own conversations"
    on public.conversations for delete
    using (exists (
        select 1 from public.users
        where users.id = conversations.user_id
        and users.auth0_id = auth.uid()::text
    ));

-- Messages policies
create policy "Users can view messages in their conversations"
    on public.messages for select
    using (exists (
        select 1 from public.users u
        join public.conversations c on c.user_id = u.id
        where c.id = messages.conversation_id
        and u.auth0_id = auth.uid()::text
    ));

create policy "Users can create messages in their conversations"
    on public.messages for insert
    with check (exists (
        select 1 from public.users u
        join public.conversations c on c.user_id = u.id
        where c.id = conversation_id
        and u.auth0_id = auth.uid()::text
    ));

-- Generated images policies
create policy "Users can view their generated images"
    on public.generated_images for select
    using (exists (
        select 1 from public.users u
        join public.messages m on m.user_id = u.id
        where m.id = generated_images.message_id
        and u.auth0_id = auth.uid()::text
    ));

create policy "Users can create generated images for their messages"
    on public.generated_images for insert
    with check (exists (
        select 1 from public.users u
        join public.messages m on m.user_id = u.id
        where m.id = message_id
        and u.auth0_id = auth.uid()::text
    )); 