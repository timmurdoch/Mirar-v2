-- Seed Data for Testing
-- Migration: 003_seed_data
-- Note: This should be run after creating users via Supabase Auth

-- ============================================
-- SAMPLE QUESTIONNAIRE VERSION
-- ============================================

INSERT INTO public.questionnaire_versions (id, version_number, name, description, status, published_at, created_at)
VALUES
    ('11111111-1111-1111-1111-111111111111', 1, 'Initial Facility Audit v1', 'First version of the facility audit questionnaire', 'published', NOW(), NOW());

-- ============================================
-- SAMPLE SECTIONS
-- ============================================

INSERT INTO public.sections (id, questionnaire_version_id, name, description, sort_order)
VALUES
    ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', 'General Information', 'Basic facility information', 1),
    ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', 'Facility Condition', 'Assessment of facility condition', 2),
    ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111111', 'Amenities', 'Available amenities and services', 3),
    ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111111', 'Accessibility', 'Accessibility features', 4);

-- ============================================
-- SAMPLE QUESTIONS
-- ============================================

-- General Information Section
INSERT INTO public.questions (id, section_id, question_key, label, description, question_type, options, is_required, sort_order)
VALUES
    ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', 'facility_type', 'Facility Type', 'Primary type of sports facility', 'list', '["Indoor Stadium", "Outdoor Field", "Aquatic Center", "Multi-purpose Complex", "Tennis Center", "Golf Course", "Gymnasium", "Other"]', true, 1),
    ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222201', 'primary_sport', 'Primary Sport', 'Main sport played at this facility', 'list', '["Football", "Basketball", "Tennis", "Swimming", "Cricket", "Rugby", "Netball", "Athletics", "Multiple Sports", "Other"]', true, 2),
    ('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222201', 'ownership_type', 'Ownership Type', 'Who owns the facility', 'radio', '["Council Owned", "State Government", "Private", "Club Owned", "School/University", "Other"]', true, 3),
    ('33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222201', 'year_built', 'Year Built', 'Approximate year facility was constructed', 'number', null, false, 4),
    ('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222201', 'additional_notes', 'Additional Notes', 'Any other relevant information', 'string', null, false, 5);

-- Facility Condition Section
INSERT INTO public.questions (id, section_id, question_key, label, description, question_type, options, is_required, sort_order)
VALUES
    ('33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222202', 'overall_condition', 'Overall Condition', 'General condition of the facility', 'radio', '["Excellent", "Good", "Fair", "Poor", "Critical"]', true, 1),
    ('33333333-3333-3333-3333-333333333307', '22222222-2222-2222-2222-222222222202', 'playing_surface_condition', 'Playing Surface Condition', 'Condition of the main playing surface', 'radio', '["Excellent", "Good", "Fair", "Poor", "Critical"]', true, 2),
    ('33333333-3333-3333-3333-333333333308', '22222222-2222-2222-2222-222222222202', 'maintenance_frequency', 'Maintenance Frequency', 'How often is the facility maintained', 'list', '["Daily", "Weekly", "Monthly", "Quarterly", "Annually", "As Needed"]', false, 3),
    ('33333333-3333-3333-3333-333333333309', '22222222-2222-2222-2222-222222222202', 'last_renovation_year', 'Last Renovation Year', 'Year of last major renovation', 'number', null, false, 4),
    ('33333333-3333-3333-3333-333333333310', '22222222-2222-2222-2222-222222222202', 'condition_notes', 'Condition Notes', 'Additional notes about facility condition', 'string', null, false, 5);

-- Amenities Section
INSERT INTO public.questions (id, section_id, question_key, label, description, question_type, options, is_required, sort_order)
VALUES
    ('33333333-3333-3333-3333-333333333311', '22222222-2222-2222-2222-222222222203', 'amenities_available', 'Available Amenities', 'Select all available amenities', 'checkbox', '["Changing Rooms", "Showers", "Toilets", "Canteen/Cafe", "Equipment Storage", "First Aid Room", "Meeting Room", "Spectator Seating", "Parking", "Lighting", "Scoreboard", "PA System"]', false, 1),
    ('33333333-3333-3333-3333-333333333312', '22222222-2222-2222-2222-222222222203', 'changing_room_capacity', 'Changing Room Capacity', 'Number of people changing rooms can accommodate', 'number', null, false, 2),
    ('33333333-3333-3333-3333-333333333313', '22222222-2222-2222-2222-222222222203', 'parking_spaces', 'Parking Spaces', 'Approximate number of parking spaces', 'number', null, false, 3),
    ('33333333-3333-3333-3333-333333333314', '22222222-2222-2222-2222-222222222203', 'spectator_capacity', 'Spectator Capacity', 'Maximum spectator capacity', 'number', null, false, 4);

-- Accessibility Section
INSERT INTO public.questions (id, section_id, question_key, label, description, question_type, options, is_required, sort_order)
VALUES
    ('33333333-3333-3333-3333-333333333315', '22222222-2222-2222-2222-222222222204', 'accessibility_features', 'Accessibility Features', 'Select all accessibility features', 'checkbox', '["Wheelchair Ramps", "Accessible Toilets", "Accessible Parking", "Handrails", "Tactile Indicators", "Hearing Loop", "Accessible Seating", "Elevator/Lift"]', false, 1),
    ('33333333-3333-3333-3333-333333333316', '22222222-2222-2222-2222-222222222204', 'wheelchair_accessible', 'Wheelchair Accessible', 'Is the main facility wheelchair accessible', 'radio', '["Yes - Fully", "Yes - Partially", "No", "Unknown"]', true, 2),
    ('33333333-3333-3333-3333-333333333317', '22222222-2222-2222-2222-222222222204', 'accessibility_rating', 'Accessibility Rating', 'Overall accessibility rating', 'radio', '["Excellent", "Good", "Fair", "Poor", "Not Assessed"]', false, 3);

-- ============================================
-- SAMPLE FACILITIES
-- ============================================

INSERT INTO public.facilities (id, venue_name, venue_address, town_suburb, postcode, state, latitude, longitude, is_deleted, created_at)
VALUES
    ('44444444-4444-4444-4444-444444444401', 'Melbourne Sports Stadium', '123 Sports Drive', 'Melbourne', '3000', 'VIC', -37.8136, 144.9631, false, NOW()),
    ('44444444-4444-4444-4444-444444444402', 'Sydney Olympic Park', 'Olympic Boulevard', 'Sydney Olympic Park', '2127', 'NSW', -33.8472, 151.0694, false, NOW()),
    ('44444444-4444-4444-4444-444444444403', 'Brisbane Recreation Center', '45 Recreation Way', 'South Brisbane', '4101', 'QLD', -27.4705, 153.0260, false, NOW()),
    ('44444444-4444-4444-4444-444444444404', 'Adelaide Sports Complex', '78 Stadium Road', 'Adelaide', '5000', 'SA', -34.9285, 138.6007, false, NOW()),
    ('44444444-4444-4444-4444-444444444405', 'Perth Athletic Centre', '12 Track Lane', 'Perth', '6000', 'WA', -31.9505, 115.8605, false, NOW()),
    ('44444444-4444-4444-4444-444444444406', 'Hobart Aquatic Center', '56 Pool Street', 'Hobart', '7000', 'TAS', -42.8821, 147.3272, false, NOW()),
    ('44444444-4444-4444-4444-444444444407', 'Canberra Multi-Sport Arena', '90 Capital Avenue', 'Canberra', '2600', 'ACT', -35.2809, 149.1300, false, NOW()),
    ('44444444-4444-4444-4444-444444444408', 'Darwin Community Sports Ground', '34 Tropical Road', 'Darwin', '0800', 'NT', -12.4634, 130.8456, false, NOW()),
    ('44444444-4444-4444-4444-444444444409', 'Gold Coast Tennis Center', '67 Coastal Drive', 'Surfers Paradise', '4217', 'QLD', -28.0027, 153.4318, false, NOW()),
    ('44444444-4444-4444-4444-444444444410', 'Geelong Regional Sports Park', '23 Regional Parkway', 'Geelong', '3220', 'VIC', -38.1499, 144.3617, false, NOW());

-- ============================================
-- DEFAULT TOOLTIP CONFIGURATION
-- ============================================

INSERT INTO public.tooltip_config (field_source, field_key, display_label, sort_order, is_active)
VALUES
    ('facility', 'venue_name', 'Venue Name', 1, true),
    ('facility', 'venue_address', 'Address', 2, true),
    ('facility', 'town_suburb', 'Town/Suburb', 3, true),
    ('facility', 'state', 'State', 4, true),
    ('question', 'facility_type', 'Facility Type', 5, true),
    ('question', 'overall_condition', 'Condition', 6, true);

-- ============================================
-- DEFAULT FILTER CONFIGURATION
-- ============================================

INSERT INTO public.filter_config (field_source, field_key, display_label, filter_type, sort_order, is_active)
VALUES
    ('facility', 'state', 'State', 'select', 1, true),
    ('facility', 'town_suburb', 'Town/Suburb', 'text', 2, true),
    ('question', 'facility_type', 'Facility Type', 'select', 3, true),
    ('question', 'overall_condition', 'Overall Condition', 'select', 4, true),
    ('question', 'wheelchair_accessible', 'Wheelchair Accessible', 'select', 5, true);
