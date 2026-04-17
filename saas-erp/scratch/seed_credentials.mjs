import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://sqqxbxffwwfxmcqgjvui.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcXhieGZmd3dmeG1jcWdqdnVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NzIzNzksImV4cCI6MjA5MTQ0ODM3OX0.8bsScNKKLwuPMW7g97Fcjdoe_VnoVbsBkOW-R9_kREA";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function regenerate() {
    console.log('--- Database Initialization & Credential Generation ---');
    
    // 1. Create a Default School if none exists
    let schoolId;
    const { data: existingSchools } = await supabase.from('schools').select('*').limit(1);
    
    if (!existingSchools || existingSchools.length === 0) {
        console.log('No schools found. Creating "Global Elite Academy"...');
        const { data: newSchool, error: schoolErr } = await supabase.from('schools').insert([{
            name: 'Global Elite Academy',
            address: 'Main Boulevard, Sector 1',
            contact_email: 'admin@globalelite.edu',
            contact_phone: '042-111-222-333'
        }]).select().single();
        
        if (schoolErr) {
            console.error('Failed to create school:', schoolErr);
            return;
        }
        schoolId = newSchool.id;
    } else {
        schoolId = existingSchools[0].id;
        console.log(`Using existing school: ${existingSchools[0].name}`);
    }

    // 2. Clear current data
    await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('parents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('family_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // 3. Create Families and Students
    const seedData = [
      { family: 'Ali', father: 'Zahid Ali', phone: '03001234567', students: ['Ahmed Ali', 'Sara Ali'] },
      { family: 'Khan', father: 'Imran Khan', phone: '03217654321', students: ['Bilal Khan', 'Dua Khan'] },
      { family: 'Ahmed', father: 'Salman Ahmed', phone: '03339998887', students: ['Mustafa Ahmed', 'Zainab Ahmed'] }
    ];

    for (const item of seedData) {
        // Family Group
        const { data: famGroup } = await supabase.from('family_groups').insert([{
            school_id: schoolId,
            family_name: `${item.family} Family`,
            primary_contact: item.father,
            primary_phone: item.phone,
            address: `House ${Math.floor(Math.random()*50)}, ${item.family} Street`
        }]).select().single();

        if (!famGroup) continue;

        // Parent Credentials (Planned Pattern)
        // Username: Father's First Name + Random 4 digits
        // Password: Father's First Name + Last 3 of Phone
        const fatherFirstName = item.father.split(' ')[0];
        const famSuffix = Math.floor(1000 + Math.random() * 9000).toString();
        const parentUser = `${fatherFirstName}${famSuffix}`;
        const parentPass = `${fatherFirstName}${item.phone.slice(-3)}`;
        
        const { data: parent } = await supabase.from('parents').insert([{
            school_id: schoolId,
            family_group_id: famGroup.id,
            family_number: parentUser,
            auth_password: parentPass,
            full_name: item.father,
            father_name: item.father,
            whatsapp_number: item.phone,
            address: famGroup.address
        }]).select().single();

        if (!parent) continue;

        console.log(`\n👨 Parent: ${item.father}`);
        console.log(`   Username: ${parentUser} | Password: ${parentPass}`);

        // Students
        for (const sName of item.students) {
            const rollNo = Math.floor(1000 + Math.random() * 9000);
            const studentFirstName = sName.split(' ')[0];
            
            // Student Credentials (Planned Pattern)
            // Username: FirstName + Roll (e.g. Ahmed1002)
            // Password: FirstName + Last 3 of Roll (e.g. Ahmed002)
            const studentUser = `${studentFirstName}${rollNo}`;
            const studentPass = `${studentFirstName}${rollNo.toString().slice(-3)}`;

            await supabase.from('students').insert([{
                school_id: schoolId,
                parent_id: parent.id,
                family_group_id: famGroup.id,
                full_name: sName,
                roll_number: rollNo,
                student_unique_id: studentUser,
                auth_password: studentPass,
                status: 'active',
                admission_date: '2023-09-01'
            }]);
            
            console.log(`   👶 Student: ${sName}`);
            console.log(`      Username: ${studentUser} | Password: ${studentPass}`);
        }
    }
    
    console.log('\n✅ Database Seeded Successfully with Planned Credentials.');
}

regenerate();
