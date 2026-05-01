import { useMemo, useState, useEffect } from "react";
import { supabase } from "./supabase";
import "./App.css";

function App() {

  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [isResetPasswordPage, setIsResetPasswordPage] = useState(
    window.location.pathname === "/reset-password"
  );
  const [passwordRecoveryProfiles, setPasswordRecoveryProfiles] = useState([]);
  const [selectedRecoveryProfileId, setSelectedRecoveryProfileId] = useState("");
  const [dbProfile, setDbProfile] = useState(null);
  const currentUser = dbProfile?.name || "Unknown User";
  const currentRole = dbProfile?.role
    ? dbProfile.role.charAt(0).toUpperCase() + dbProfile.role.slice(1)
    : "";

  const isOwner = currentRole === "Owner";
  const isParent = currentRole === "Parent";
  const isChild = currentRole === "Child";

  const canManageRewards = isOwner || isParent;
  const canSeeParentControls = isOwner || isParent;
  const canDeleteItems = isOwner || isParent;
  const canSwitchUsers = isOwner;
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [newRewardRequest, setNewRewardRequest] = useState({
    title: "",
    suggestedPoints: 25,
    note: "",
    link: "",
  });
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    age: "",
    role: "child",
    email: "",
    password: "",
    household_id: "",
  });
  const [households, setHouseholds] = useState([]);
  const [childProfiles, setChildProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [selectedTotals, setSelectedTotals] = useState(null);
  const [selectedDeductions, setSelectedDeductions] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState([]);
  const [selectedChores, setSelectedChores] = useState([]);
  const [selectedHygiene, setSelectedHygiene] = useState([]);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [selectedRewards, setSelectedRewards] = useState([]);
  const [selectedRewardRequests, setSelectedRewardRequests] = useState([]);
  const [pendingFulfillmentRewards, setPendingFulfillmentRewards] = useState([]);
  const [allTotals, setAllTotals] = useState([]);
  const [newDeduction, setNewDeduction] = useState({
    reason: "",
    points: 10,
  });
  const [newChore, setNewChore] = useState({ title: "", points: 5, frequency: "Daily" });
  const [newHygiene, setNewHygiene] = useState({ title: "", points: 2, frequency: "Daily" });
  const [newTaskItem, setNewTaskItem] = useState({ title: "", points: 5, frequency: "One-Time" });
  const [newReward, setNewReward] = useState({ title: "", cost: 20 });
  const [requestApprovalEdits, setRequestApprovalEdits] = useState({});
  const [screenCostInput, setScreenCostInput] = useState("10");
  const [readingGoalInput, setReadingGoalInput] = useState("0");
  const [readingPointsInput, setReadingPointsInput] = useState("2");
  const [now, setNow] = useState(new Date());
  const [dailyMessage, setDailyMessage] = useState({
    label: "Today’s Boost",
    text: "Loading something fun...",
    emoji: "✨",
  });
  const selectedProfile = useMemo(() => {
    if (isChild) {
      return childProfiles.find((p) => p.id === dbProfile?.id) || null;
    }

    return childProfiles.find((p) => p.id === selectedProfileId) || null;
  }, [childProfiles, selectedProfileId, isChild, dbProfile]);

  useEffect(() => {
    // Run immediately on load
    fetchDailyMessage();

    // Calculate time until next top of hour
    const now = new Date();
    const msUntilNextHour =
      (60 - now.getMinutes()) * 60 * 1000 -
      now.getSeconds() * 1000 -
      now.getMilliseconds();

    // Wait until next hour, then run every hour
    const timeout = setTimeout(() => {
      fetchDailyMessage();

      const interval = setInterval(fetchDailyMessage, 60 * 60 * 1000);

      // store interval on window so we can clear if needed
      window.__dailyMessageInterval = interval;
    }, msUntilNextHour);

    return () => {
      clearTimeout(timeout);
      if (window.__dailyMessageInterval) {
        clearInterval(window.__dailyMessageInterval);
      }
    };
  }, []);

  useEffect(() => {
    if (!dbProfile) return;

    if (isChild) {
      setSelectedProfileId(dbProfile.id);
      return;
    }

    if (!selectedProfileId && childProfiles.length > 0) {
      setSelectedProfileId(childProfiles[0].id);
    }
  }, [dbProfile, isChild, childProfiles, selectedProfileId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000 * 30);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      if (event === "PASSWORD_RECOVERY") {
        setIsResetPasswordPage(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.user?.id) {
        setDbProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_user_id", session.user.id)
        .single();

      if (error) {
        console.log("Profile load error:", error.message);
        setDbProfile(null);
        return;
      }

      console.log("Loaded profile:", data);
      setDbProfile(data);
    };

    loadProfile();
  }, [session]);

  useEffect(() => {
    const loadPasswordRecoveryProfiles = async () => {
      if (!dbProfile || !isOwner) {
        setPasswordRecoveryProfiles([]);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, role, email")
        .order("name", { ascending: true });

      if (error) {
        console.log("Password recovery profiles load error:", error.message);
        setPasswordRecoveryProfiles([]);
        return;
      }

      setPasswordRecoveryProfiles(data || []);
    };

    loadPasswordRecoveryProfiles();
  }, [dbProfile, isOwner]);

  useEffect(() => {
    const loadHouseholds = async () => {
      if (!dbProfile || !isOwner) {
        setHouseholds([]);
        return;
      }

      const { data, error } = await supabase
        .from("households")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) {
        console.log("Households load error:", error.message);
        setHouseholds([]);
        return;
      }

      setHouseholds(data || []);
    };

    loadHouseholds();
  }, [dbProfile, isOwner]);

  useEffect(() => {
    const loadChildProfiles = async () => {
      if (!dbProfile) {
        setChildProfiles([]);
        return;
      }

      let query = supabase
        .from("profiles")
        .select("id, name, age, role, household_id")
        .eq("role", "child")
        .order("name", { ascending: true });

      if (!isOwner) {
        query = query.eq("household_id", dbProfile.household_id);
      }

      const { data, error } = await query;

      if (error) {
        console.log("Child profiles load error:", error.message);
        setChildProfiles([]);
        return;
      }

      setChildProfiles(data || []);
    };

    loadChildProfiles();
  }, [dbProfile, isOwner]);

  useEffect(() => {
    const loadSelectedTotals = async () => {
      if (!selectedProfile?.id) {
        setSelectedTotals(null);
        return;
      }

      const { data, error } = await supabase
        .from("profile_totals")
        .select("*")
        .eq("profile_id", selectedProfile.id)
        .single();

      if (error) {
        console.log("Selected totals load error:", error.message);
        console.log("Selected totals query result:", { data, error, selectedProfile });
        setSelectedTotals(null);
        return;
      }

      setSelectedTotals(data);
    };

    loadSelectedTotals();
  }, [selectedProfile]);

  useEffect(() => {
    const loadAllTotals = async () => {
      if (!dbProfile || childProfiles.length === 0) {
        setAllTotals([]);
        return;
      }

      const profileIds = childProfiles.map((p) => p.id);

      const { data, error } = await supabase
        .from("profile_totals")
        .select("*")
        .in("profile_id", profileIds);

      if (error) {
        console.log("All totals load error:", error.message);
        setAllTotals([]);
        return;
      }

      setAllTotals(data || []);
    };

    loadAllTotals();
  }, [dbProfile, childProfiles, selectedTotals]);

  useEffect(() => {
    const loadSelectedDeductions = async () => {
      if (!selectedProfile?.id) {
        setSelectedDeductions([]);
        return;
      }

      const { data, error } = await supabase
        .from("deduction_log")
        .select("*")
        .eq("profile_id", selectedProfile.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Selected deductions load error:", error.message);
        setSelectedDeductions([]);
        return;
      }

      setSelectedDeductions(data || []);
    };

    loadSelectedDeductions();
  }, [selectedProfile, selectedTotals]);

  useEffect(() => {
    const loadSelectedActivity = async () => {
      if (!selectedProfile?.id) {
        setSelectedActivity([]);
        return;
      }

      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("profile_id", selectedProfile.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Selected activity load error:", error.message);
        setSelectedActivity([]);
        return;
      }

      setSelectedActivity(data || []);
    };

    loadSelectedActivity();
  }, [selectedProfile, selectedTotals, selectedDeductions]);

  useEffect(() => {
    const loadSelectedChores = async () => {
      if (!selectedProfile?.id) {
        setSelectedChores([]);
        return;
      }

      const { data, error } = await supabase
        .from("chores")
        .select("*")
        .eq("profile_id", selectedProfile.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        console.log("Selected chores load error:", error.message);
        setSelectedChores([]);
        return;
      }

      setSelectedChores(data || []);
    };

    loadSelectedChores();
  }, [selectedProfile, selectedTotals]);

  useEffect(() => {
    const loadSelectedHygiene = async () => {
      if (!selectedProfile?.id) {
        setSelectedHygiene([]);
        return;
      }

      const { data, error } = await supabase
        .from("hygiene")
        .select("*")
        .eq("profile_id", selectedProfile.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        console.log("Selected hygiene load error:", error.message);
        setSelectedHygiene([]);
        return;
      }

      setSelectedHygiene(data || []);
    };

    loadSelectedHygiene();
  }, [selectedProfile, selectedTotals]);

  useEffect(() => {
    const loadSelectedTasks = async () => {
      const householdId = selectedProfile?.household_id || dbProfile?.household_id;

      if (!householdId) {
        setSelectedTasks([]);
        return;
      }

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("household_id", householdId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        console.log("Selected tasks load error:", error.message);
        setSelectedTasks([]);
        return;
      }

      setSelectedTasks(data || []);
    };

    loadSelectedTasks();
  }, [selectedProfile, dbProfile, selectedTotals]);

  useEffect(() => {
    const loadSelectedRewards = async () => {
      if (!selectedProfile?.id) {
        setSelectedRewards([]);
        return;
      }

      const { data, error } = await supabase
        .from("rewards")
        .select("*")
        .eq("profile_id", selectedProfile.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        console.log("Selected rewards load error:", error.message);
        setSelectedRewards([]);
        return;
      }

      setSelectedRewards(data || []);
    };

    loadSelectedRewards();
  }, [selectedProfile, selectedTotals]);

  useEffect(() => {
    const loadSelectedRewardRequests = async () => {
      if (!selectedProfile?.id) {
        setSelectedRewardRequests([]);
        return;
      }

      const { data, error } = await supabase
        .from("reward_requests")
        .select("*")
        .eq("profile_id", selectedProfile.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        console.log("Selected reward requests load error:", error.message);
        setSelectedRewardRequests([]);
        return;
      }

      setSelectedRewardRequests(data || []);
    };

    loadSelectedRewardRequests();
  }, [selectedProfile, selectedTotals]);

  useEffect(() => {
    const loadPendingFulfillmentRewards = async () => {
      if (!dbProfile || !canManageRewards || !selectedProfile?.id) {
        setPendingFulfillmentRewards([]);
        return;
      }

      let query = supabase
        .from("rewards")
        .select("*")
        .eq("status", "redeemed_pending_fulfillment")
        .eq("profile_id", selectedProfile.id)
        .order("redeemed_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (!isOwner) {
        query = query.eq("assigned_parent_profile_id", dbProfile.id);
      }

      const { data, error } = await query;

      if (error) {
        console.log("Pending fulfillment rewards load error:", error.message);
        setPendingFulfillmentRewards([]);
        return;
      }

      setPendingFulfillmentRewards(data || []);
    };

    loadPendingFulfillmentRewards();
  }, [dbProfile, canManageRewards, childProfiles, isOwner, selectedProfile, selectedRewards]);

  useEffect(() => {
    if (!selectedTotals) return;
    setScreenCostInput(String(selectedTotals.screen_time_cost_per_10 ?? 0));
    setReadingGoalInput(String(selectedTotals.daily_reading_goal ?? 0));
    setReadingPointsInput(String(selectedTotals.reading_points_per_10 ?? 2));
  }, [selectedTotals]);

  const selectedKid = useMemo(() => {
    if (!selectedProfile || !selectedTotals) return null;

    return {
      id: selectedProfile.id,
      name: selectedProfile.name,
      age: selectedProfile.age,
      points: selectedTotals.points,
      weeklyGoal: selectedTotals.weekly_goal,
      readingMinutes: selectedTotals.reading_minutes,
      readingToday: selectedTotals.reading_today,
      dailyReadingGoal: selectedTotals.daily_reading_goal,
      readingPointsPer10: selectedTotals.reading_points_per_10 ?? 2,
      readingDebt: selectedTotals.reading_debt,
      readingBank: selectedTotals.reading_bank,
      learningMinutes: selectedTotals.learning_minutes,
      choresDone: selectedTotals.chores_done,
      hygieneDone: selectedTotals.hygiene_done,
      screenTimePendingMinutes: selectedTotals.screen_time_pending_minutes,
      screenTimePendingCost: selectedTotals.screen_time_pending_cost,
      screenTimeCostPer10: selectedTotals.screen_time_cost_per_10,
      availableScreenTime: selectedTotals.available_screen_time,
      usedScreenTime: selectedTotals.used_screen_time,
      chores: selectedChores.map((item) => ({
        id: item.id,
        title: item.title,
        points: item.points,
        done: item.done,
        frequency: item.frequency,
        is_active: item.is_active,
        completed_at: item.completed_at,
        delete_after_reset: item.delete_after_reset,
      })),
      hygiene: selectedHygiene.map((item) => ({
        id: item.id,
        title: item.title,
        points: item.points,
        done: item.done,
        frequency: item.frequency,
        is_active: item.is_active,
        completed_at: item.completed_at,
        delete_after_reset: item.delete_after_reset,
      })),
      tasks: selectedTasks.map((item) => ({
        id: item.id,
        household_id: item.household_id,
        title: item.title,
        points: item.points,
        done: item.done,
        frequency: item.frequency,
        is_active: item.is_active,
        completed_at: item.completed_at,
        delete_after_reset: item.delete_after_reset,
        completed_by_profile_id: item.completed_by_profile_id,
        completed_by_name: item.completed_by_name,
      })),
      rewards: selectedRewards.map((item) => ({
        id: item.id,
        title: item.title,
        cost: item.cost,
        claimed: item.claimed,
        status: item.status,
      })),
      rewardRequests: selectedRewardRequests.map((item) => ({
        id: item.id,
        title: item.title,
        suggestedPoints: item.suggested_points,
        note: item.note || "",
        link: item.link || "",
        status: item.status,
        requestedBy: item.requested_by_name || "Unknown",
        approvedCost: item.approved_cost,
        viewed: item.viewed,
      })),
      activity: selectedActivity.map((item) => ({
        id: item.id,
        text: item.text,
        by: item.by_name || "Unknown",
        timestamp: item.created_at,
        time: item.created_at,
      })),
      deductions: selectedDeductions,
    };
  }, [selectedProfile, selectedTotals, selectedDeductions, selectedActivity, selectedChores, selectedHygiene, selectedTasks, selectedRewards, selectedRewardRequests]);

  const allTotalsByProfileId = useMemo(() => {
    return Object.fromEntries((allTotals || []).map((row) => [row.profile_id, row]));
  }, [allTotals]);

  const childProfilesById = useMemo(() => {
    return Object.fromEntries((childProfiles || []).map((child) => [child.id, child]));
  }, [childProfiles]);

  const updateSelectedTotalsRow = async (updates) => {
    if (!selectedProfile?.id) {
      console.log("No selected profile to update.");
      return null;
    }

    const { error: updateError } = await supabase
      .from("profile_totals")
      .update(updates)
      .eq("profile_id", selectedProfile.id);

    if (updateError) {
      console.log("profile_totals update error:", updateError.message);
      return null;
    }

    const { data, error: refreshError } = await supabase
      .from("profile_totals")
      .select("*")
      .eq("profile_id", selectedProfile.id)
      .maybeSingle();

    if (refreshError) {
      console.log("profile_totals refresh error:", refreshError.message);
      return null;
    }

    if (!data) {
      console.log("profile_totals refresh error: no row found after update");
      return null;
    }

    setSelectedTotals(data);
    return data;
  };



  const insertActivityLog = async (text) => {
    if (!selectedProfile?.id || !dbProfile?.id) return;

    const { error } = await supabase.from("activity_log").insert({
      profile_id: selectedProfile.id,
      text,
      by_profile_id: dbProfile.id,
      by_name: dbProfile.name,
    });

    if (error) {
      console.log("Activity log insert error:", error.message);
      return;
    }

    const { data, error: refreshError } = await supabase
      .from("activity_log")
      .select("*")
      .eq("profile_id", selectedProfile.id)
      .order("created_at", { ascending: false });

    if (!refreshError) {
      setSelectedActivity(data || []);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getRecentActivity = (activityList, role) => {
    const now = Date.now();
    const maxAgeMs =
      role === "Child" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

    return (activityList || []).filter((item) => {
      if (!item.timestamp) return true;
      const time = new Date(item.timestamp).getTime();
      if (Number.isNaN(time)) return true;
      return now - time <= maxAgeMs;
    });
  };

  const totals = useMemo(() => {
    return allTotals.reduce(
      (acc, row) => {
        acc.points += row.points || 0;
        acc.readingMinutes += row.reading_minutes || 0;
        acc.learningMinutes += row.learning_minutes || 0;
        acc.choresDone += row.chores_done || 0;
        acc.hygieneDone += row.hygiene_done || 0;
        return acc;
      },
      { points: 0, readingMinutes: 0, learningMinutes: 0, choresDone: 0, hygieneDone: 0 }
    );
  }, [allTotals]);

  const toggleItem = async (itemId, section) => {
    if (!selectedProfile?.id || !selectedTotals) return;

    const config = {
      chores: {
        items: selectedChores,
        table: "chores",
        doneCountField: "chores_done",
        setItems: setSelectedChores,
        label: "chore",
      },
      hygiene: {
        items: selectedHygiene,
        table: "hygiene",
        doneCountField: "hygiene_done",
        setItems: setSelectedHygiene,
        label: "hygiene",
      },
      tasks: {
        items: selectedTasks,
        table: "tasks",
        doneCountField: null,
        setItems: setSelectedTasks,
        label: "household task",
      },
    };

    const selectedConfig = config[section];

    if (!selectedConfig) {
      alert(`${section} is not migrated to the database yet.`);
      return;
    }

    const target = selectedConfig.items.find((item) => item.id === itemId);
    if (!target) return;

    const newDone = !target.done;
    const pointDelta = newDone ? target.points : -target.points;

    const itemUpdates = {
      done: newDone,
      completed_at: newDone ? new Date().toISOString() : null,
    };

    if (section === "tasks") {
      itemUpdates.completed_by_profile_id = newDone ? selectedProfile.id : null;
      itemUpdates.completed_by_name = newDone ? selectedProfile.name : null;
    }

    if (newDone) {
      itemUpdates.is_active = false;

      if (target.frequency === "One-Time") {
        itemUpdates.delete_after_reset = true;
      }
    } else {
      itemUpdates.is_active = true;
      itemUpdates.delete_after_reset = false;
    }

    const { error } = await supabase
      .from(selectedConfig.table)
      .update(itemUpdates)
      .eq("id", itemId);

    if (error) {
      console.log(`Toggle ${selectedConfig.label} error:`, error.message);
      return;
    }

    const totalsUpdate = {
      points: Math.max(0, (selectedTotals.points || 0) + pointDelta),
    };

    if (selectedConfig.doneCountField) {
      const countDelta = newDone ? 1 : -1;
      totalsUpdate[selectedConfig.doneCountField] = Math.max(
        0,
        (selectedTotals[selectedConfig.doneCountField] || 0) + countDelta
      );
    }

    const updatedTotals = await updateSelectedTotalsRow(totalsUpdate);
    if (!updatedTotals) return;

    let refreshQuery = supabase
      .from(selectedConfig.table)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (section === "tasks") {
      refreshQuery = refreshQuery.eq(
        "household_id",
        selectedProfile.household_id || dbProfile.household_id
      );
    } else {
      refreshQuery = refreshQuery.eq("profile_id", selectedProfile.id);
    }

    const { data, error: refreshError } = await refreshQuery;

    if (!refreshError) {
      selectedConfig.setItems(data || []);
    }

    await insertActivityLog(
      `${newDone ? `+${target.points} pts — Completed ${selectedConfig.label}` : `-${target.points} pts — Unchecked ${selectedConfig.label}`}: ${target.title}`
    );
  };

  const addItem = async (section, newItem) => {
    if (!newItem.title.trim() || !selectedProfile?.id || !dbProfile?.id) return;

    if (section === "chores") {
      const nextSortOrder =
        selectedChores.length > 0
          ? Math.max(...selectedChores.map((item) => item.sort_order || 0)) + 1
          : 1;

      const { error } = await supabase.from("chores").insert({
        profile_id: selectedProfile.id,
        title: newItem.title.trim(),
        points: Number(newItem.points) || 0,
        done: false,
        frequency: newItem.frequency || "Daily",
        sort_order: nextSortOrder,
        created_by_profile_id: dbProfile.id,
        created_by_name: dbProfile.name,
      });

      if (error) {
        console.log("Add chore error:", error.message);
        return;
      }

      const { data, error: refreshError } = await supabase
        .from("chores")
        .select("*")
        .eq("profile_id", selectedProfile.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!refreshError) {
        setSelectedChores(data || []);
      }

      await insertActivityLog(`Added chore: ${newItem.title}`);
      setNewChore({ title: "", points: 5, frequency: "Daily" });
      return;
    }

    if (section === "hygiene") {
      const nextSortOrder =
        selectedHygiene.length > 0
          ? Math.max(...selectedHygiene.map((item) => item.sort_order || 0)) + 1
          : 1;

      const { error } = await supabase.from("hygiene").insert({
        profile_id: selectedProfile.id,
        title: newItem.title.trim(),
        points: Number(newItem.points) || 0,
        done: false,
        frequency: newItem.frequency || "Daily",
        sort_order: nextSortOrder,
        created_by_profile_id: dbProfile.id,
        created_by_name: dbProfile.name,
      });

      if (error) {
        console.log("Add hygiene error:", error.message);
        return;
      }

      const { data, error: refreshError } = await supabase
        .from("hygiene")
        .select("*")
        .eq("profile_id", selectedProfile.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!refreshError) {
        setSelectedHygiene(data || []);
      }

      await insertActivityLog(`Added hygiene: ${newItem.title}`);
      setNewHygiene({ title: "", points: 2, frequency: "Daily" });
      return;
    }

    if (section === "tasks") {
      const householdId = selectedProfile?.household_id || dbProfile?.household_id;

      if (!householdId) {
        console.log("Add task error: no household id found.");
        return;
      }

      const nextSortOrder =
        selectedTasks.length > 0
          ? Math.max(...selectedTasks.map((item) => item.sort_order || 0)) + 1
          : 1;

      const { error } = await supabase.from("tasks").insert({
        household_id: householdId,
        profile_id: null,
        title: newItem.title.trim(),
        points: Number(newItem.points) || 0,
        done: false,
        is_active: true,
        delete_after_reset: false,
        completed_at: null,
        completed_by_profile_id: null,
        completed_by_name: null,
        frequency: newItem.frequency || "One-Time",
        sort_order: nextSortOrder,
        created_by_profile_id: dbProfile.id,
        created_by_name: dbProfile.name,
      });

      if (error) {
        console.log("Add task error:", error.message);
        return;
      }

      const { data, error: refreshError } = await supabase
        .from("tasks")
        .select("*")
        .eq("household_id", householdId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!refreshError) {
        setSelectedTasks(data || []);
      }

      await insertActivityLog(`Added household task: ${newItem.title}`);
      setNewTaskItem({ title: "", points: 5, frequency: "One-Time" });
      return;
    }

    alert(`${section} is not migrated to the database yet.`);
  };

  const deleteItem = async (section, itemId) => {
    if (!canDeleteItems || !selectedProfile?.id) return;

    if (section === "chores") {
      const target = selectedChores.find((item) => item.id === itemId);
      if (!target) return;

      const { error } = await supabase
        .from("chores")
        .delete()
        .eq("id", itemId);

      if (error) {
        console.log("Delete chore error:", error.message);
        return;
      }

      const { data, error: refreshError } = await supabase
        .from("chores")
        .select("*")
        .eq("profile_id", selectedProfile.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!refreshError) {
        setSelectedChores(data || []);
      }

      await insertActivityLog(`Deleted chore: ${target.title}`);
      return;
    }

    if (section === "hygiene") {
      const target = selectedHygiene.find((item) => item.id === itemId);
      if (!target) return;

      const { error } = await supabase
        .from("hygiene")
        .delete()
        .eq("id", itemId);

      if (error) {
        console.log("Delete hygiene error:", error.message);
        return;
      }

      const { data, error: refreshError } = await supabase
        .from("hygiene")
        .select("*")
        .eq("profile_id", selectedProfile.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!refreshError) {
        setSelectedHygiene(data || []);
      }

      await insertActivityLog(`Deleted hygiene: ${target.title}`);
      return;
    }

    if (section === "tasks") {
      const target = selectedTasks.find((item) => item.id === itemId);
      if (!target) return;

      const householdId = target.household_id || selectedProfile?.household_id || dbProfile?.household_id;

      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", itemId);

      if (error) {
        console.log("Delete task error:", error.message);
        return;
      }

      const { data, error: refreshError } = await supabase
        .from("tasks")
        .select("*")
        .eq("household_id", householdId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!refreshError) {
        setSelectedTasks(data || []);
      }

      await insertActivityLog(`Deleted household task: ${target.title}`);
      return;
    }

    alert(`${section} is not migrated to the database yet.`);
  };

  const deleteReward = async (rewardId) => {
    if (!canDeleteItems || !selectedProfile?.id) return;

    const target = selectedRewards.find((item) => item.id === rewardId);
    if (!target) return;

    const { error } = await supabase
      .from("rewards")
      .delete()
      .eq("id", rewardId);

    if (error) {
      console.log("Delete reward error:", error.message);
      return;
    }

    const { data, error: refreshError } = await supabase
      .from("rewards")
      .select("*")
      .eq("profile_id", selectedProfile.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!refreshError) {
      setSelectedRewards(data || []);
    }

    await insertActivityLog(`Deleted reward: ${target.title}`);
  };

  const addReward = async () => {
    if (!newReward.title.trim() || !selectedProfile?.id || !dbProfile?.id) return;

    const nextSortOrder =
      selectedRewards.length > 0
        ? Math.max(...selectedRewards.map((item) => item.sort_order || 0)) + 1
        : 1;

    const { error } = await supabase.from("rewards").insert({
      profile_id: selectedProfile.id,
      title: newReward.title.trim(),
      cost: Number(newReward.cost) || 0,
      claimed: false,
      status: "available",
      assigned_parent_profile_id: dbProfile.id,
      assigned_parent_name: dbProfile.name,
      sort_order: nextSortOrder,
      created_by_profile_id: dbProfile.id,
      created_by_name: dbProfile.name,
    });

    if (error) {
      console.log("Add reward error:", error.message);
      return;
    }

    const { data, error: refreshError } = await supabase
      .from("rewards")
      .select("*")
      .eq("profile_id", selectedProfile.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!refreshError) {
      setSelectedRewards(data || []);
    }

    await insertActivityLog(`Added reward: ${newReward.title}`);

    setNewReward({ title: "", cost: 20 });
  };

  const addRewardRequest = async () => {
    if (!newRewardRequest.title.trim() || !selectedProfile?.id || !dbProfile?.id) return;

    const nextSortOrder =
      selectedRewardRequests.length > 0
        ? Math.max(...selectedRewardRequests.map((item) => item.sort_order || 0)) + 1
        : 1;

    const { error } = await supabase.from("reward_requests").insert({
      profile_id: selectedProfile.id,
      title: newRewardRequest.title.trim(),
      suggested_points: Number(newRewardRequest.suggestedPoints) || 0,
      note: newRewardRequest.note || "",
      link: newRewardRequest.link || "",
      status: "Pending",
      requested_by_name: dbProfile.name,
      viewed: false,
      sort_order: nextSortOrder,
      created_by_profile_id: dbProfile.id,
      created_by_name: dbProfile.name,
    });

    if (error) {
      console.log("Add reward request error:", error.message);
      return;
    }

    const { data, error: refreshError } = await supabase
      .from("reward_requests")
      .select("*")
      .eq("profile_id", selectedProfile.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!refreshError) {
      setSelectedRewardRequests(data || []);
    }

    await insertActivityLog(`Requested reward: ${newRewardRequest.title}`);

    setNewRewardRequest({
      title: "",
      suggestedPoints: 25,
      note: "",
      link: "",
    });
  };

  const approveRewardRequest = async (requestId) => {
    if (!canManageRewards || !selectedProfile?.id || !dbProfile?.id) return;

    const request = selectedRewardRequests.find((req) => req.id === requestId);
    if (!request) return;

    const rawApprovalValue = requestApprovalEdits[requestId];
    const finalCost = Number(
      rawApprovalValue ?? request.approved_cost ?? request.suggested_points ?? 0
    );

    const { error: updateError } = await supabase
      .from("reward_requests")
      .update({
        status: "Approved",
        approved_cost: finalCost,
        viewed: false,
      })
      .eq("id", requestId);

    if (updateError) {
      console.log("Approve reward request update error:", updateError.message);
      return;
    }

    const { data: updatedRequest, error: requestRefreshError } = await supabase
      .from("reward_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (requestRefreshError) {
      console.log("Approve reward request refresh error:", requestRefreshError.message);
      return;
    }

    if (!updatedRequest) {
      console.log("Approve reward request refresh error: no row found after update");
      return;
    }

    const savedApprovedCost = Number(updatedRequest.approved_cost ?? 0);

    const nextSortOrder =
      selectedRewards.length > 0
        ? Math.max(...selectedRewards.map((item) => item.sort_order || 0)) + 1
        : 1;

    const { error: rewardInsertError } = await supabase
      .from("rewards")
      .insert({
        profile_id: selectedProfile.id,
        title: updatedRequest.title,
        cost: savedApprovedCost,
        claimed: false,
        status: "available",
        assigned_parent_profile_id: dbProfile.id,
        assigned_parent_name: dbProfile.name,
        sort_order: nextSortOrder,
        created_by_profile_id: dbProfile.id,
        created_by_name: dbProfile.name,
      });

    if (rewardInsertError) {
      console.log("Approve reward request reward insert error:", rewardInsertError.message);
      return;
    }

    const { data: refreshedRequests, error: requestsRefreshError } = await supabase
      .from("reward_requests")
      .select("*")
      .eq("profile_id", selectedProfile.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!requestsRefreshError) {
      setSelectedRewardRequests(refreshedRequests || []);
    }

    const { data: refreshedRewards, error: rewardsRefreshError } = await supabase
      .from("rewards")
      .select("*")
      .eq("profile_id", selectedProfile.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!rewardsRefreshError) {
      setSelectedRewards(refreshedRewards || []);
    }

    setRequestApprovalEdits((prev) => {
      const next = { ...prev };
      delete next[requestId];
      return next;
    });

    await insertActivityLog(
      `Approved reward request → ${updatedRequest.title} (${savedApprovedCost} pts)`
    );
  };

  const denyRewardRequest = async (requestId) => {
    if (!canManageRewards || !selectedProfile?.id) return;

    const request = selectedRewardRequests.find((req) => req.id === requestId);
    if (!request) return;

    const { error } = await supabase
      .from("reward_requests")
      .update({
        status: "Denied",
        viewed: false,
      })
      .eq("id", requestId);

    if (error) {
      console.log("Deny reward request error:", error.message);
      return;
    }

    const { data, error: refreshError } = await supabase
      .from("reward_requests")
      .select("*")
      .eq("profile_id", selectedProfile.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!refreshError) {
      setSelectedRewardRequests(data || []);
    }

    await insertActivityLog(`Denied reward request: ${request.title}`);
  };

  const acknowledgeRewardRequest = async (requestId) => {
    if (!selectedProfile?.id) return;

    const request = selectedRewardRequests.find((req) => req.id === requestId);
    if (!request) return;

    const { error } = await supabase
      .from("reward_requests")
      .update({
        viewed: true,
      })
      .eq("id", requestId);

    if (error) {
      console.log("Acknowledge reward request error:", error.message);
      return;
    }

    const { data, error: refreshError } = await supabase
      .from("reward_requests")
      .select("*")
      .eq("profile_id", selectedProfile.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!refreshError) {
      setSelectedRewardRequests(data || []);
    }

    await insertActivityLog(`Acknowledged reward request update: ${request.title}`);
  };

  const redeemReward = async (rewardId) => {
    if (!selectedProfile?.id || !selectedTotals) return;

    const reward = selectedRewards.find((r) => r.id === rewardId);
    if (!reward || reward.claimed) return;

    const currentPoints = selectedTotals.points || 0;
    if (currentPoints < reward.cost) return;

    const { error } = await supabase
      .from("rewards")
      .update({
        claimed: true,
        status: "redeemed_pending_fulfillment",
        redeemed_at: new Date().toISOString(),
      })
      .eq("id", rewardId);

    if (error) {
      console.log("Redeem reward update error:", error.message);
      return;
    }

    const updatedTotals = await updateSelectedTotalsRow({
      points: currentPoints - reward.cost,
    });

    if (!updatedTotals) return;

    const { data, error: refreshError } = await supabase
      .from("rewards")
      .select("*")
      .eq("profile_id", selectedProfile.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!refreshError) {
      setSelectedRewards(data || []);
    }

    await insertActivityLog(
      `Redeemed reward → ${reward.title} (${reward.cost} pts) — awaiting fulfillment by ${reward.assigned_parent_name || "assigned parent"}`
    );
  };

  const markRewardFulfilled = async (rewardId) => {
    if (!canManageRewards || !dbProfile?.id) return;

    const reward = pendingFulfillmentRewards.find((item) => item.id === rewardId);
    if (!reward) return;

    const { error } = await supabase
      .from("rewards")
      .update({
        status: "fulfilled_pending_child_ack",
        fulfilled_at: new Date().toISOString(),
        fulfilled_by_profile_id: dbProfile.id,
        fulfilled_by_name: dbProfile.name,
      })
      .eq("id", rewardId);

    if (error) {
      console.log("Mark reward fulfilled error:", error.message);
      return;
    }

    let pendingQuery = supabase
      .from("rewards")
      .select("*")
      .eq("status", "redeemed_pending_fulfillment")
      .eq("profile_id", selectedProfile.id)
      .order("redeemed_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (!isOwner) {
      pendingQuery = pendingQuery.eq("assigned_parent_profile_id", dbProfile.id);
    }

    const { data: pendingData, error: pendingRefreshError } = await pendingQuery;

    if (!pendingRefreshError) {
      setPendingFulfillmentRewards(pendingData || []);
    }

    if (selectedProfile?.id === reward.profile_id) {
      const { data: refreshedRewards, error: rewardsRefreshError } = await supabase
        .from("rewards")
        .select("*")
        .eq("profile_id", selectedProfile.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!rewardsRefreshError) {
        setSelectedRewards(refreshedRewards || []);
      }
    }

    const { error: activityError } = await supabase.from("activity_log").insert({
      profile_id: reward.profile_id,
      text: `Reward fulfilled → ${reward.title} by ${dbProfile.name}`,
      by_profile_id: dbProfile.id,
      by_name: dbProfile.name,
    });

    if (activityError) {
      console.log("Reward fulfilled activity log error:", activityError.message);
    }

    if (selectedProfile?.id === reward.profile_id) {
      const { data: refreshedActivity, error: activityRefreshError } = await supabase
        .from("activity_log")
        .select("*")
        .eq("profile_id", reward.profile_id)
        .order("created_at", { ascending: false });

      if (!activityRefreshError) {
        setSelectedActivity(refreshedActivity || []);
      }
    }
  };

  const addMinutes = async (kind, minutes) => {
    if (!selectedTotals || !selectedProfile) return;

    const isReading = kind === "reading";

    const updates = {
      reading_minutes: isReading
        ? (selectedTotals.reading_minutes || 0) + minutes
        : (selectedTotals.reading_minutes || 0),
      learning_minutes: !isReading
        ? (selectedTotals.learning_minutes || 0) + minutes
        : (selectedTotals.learning_minutes || 0),
      reading_today: isReading
        ? (selectedTotals.reading_today || 0) + minutes
        : (selectedTotals.reading_today || 0),
      points:
        (selectedTotals.points || 0) +
        (isReading
          ? Math.max(0, Math.round((minutes / 10) * (selectedTotals.reading_points_per_10 ?? 2)))
          : Math.max(1, Math.round(minutes / 5))),
    };

    const updated = await updateSelectedTotalsRow(updates);
    if (!updated) return;

    const pointsEarned = isReading
      ? Math.max(0, Math.round((minutes / 10) * (selectedTotals.reading_points_per_10 ?? 2)))
      : Math.max(1, Math.round(minutes / 5));

    await insertActivityLog(
      `+${pointsEarned} pts — ${kind === "reading" ? "Reading" : "Learning"}: ${minutes} minutes`
    );
  };

  const updateDailyReadingGoal = async () => {
    if (!selectedTotals || !selectedProfile) return;

    const newGoal = Math.max(0, Number(readingGoalInput) || 0);

    const updated = await updateSelectedTotalsRow({
      daily_reading_goal: newGoal,
    });
    if (!updated) return;

    await insertActivityLog(`Updated daily reading goal to ${newGoal} min`);

    setReadingGoalInput(String(newGoal));
  };

  const updateReadingPointsValue = async () => {
    if (!canSeeParentControls || !selectedTotals || !selectedProfile) return;

    const newValue = Math.max(0, Number(readingPointsInput) || 0);

    const updated = await updateSelectedTotalsRow({
      reading_points_per_10: newValue,
    });
    if (!updated) return;

    await insertActivityLog(`Updated reading points to ${newValue} pts per 10 min`);

    setReadingPointsInput(String(newValue));
  };

  const applyScreenCost = async () => {
    if (!canManageRewards || !selectedTotals || !selectedProfile) return;

    const parsedCost = Math.max(0, Number(screenCostInput) || 0);

    const updated = await updateSelectedTotalsRow({
      screen_time_cost_per_10: parsedCost,
    });
    if (!updated) return;

    await insertActivityLog(`Updated screen cost to ${parsedCost} pts per 10 min`);

    setScreenCostInput(String(parsedCost));
  };


  const requestScreenTime = async (minutes) => {
    if (!selectedTotals || !selectedProfile) return;

    const costPer10 = selectedTotals.screen_time_cost_per_10 || 0;
    const blocksOf10 = Math.max(1, Math.round(minutes / 10));
    const addedCost = costPer10 * blocksOf10;

    const updated = await updateSelectedTotalsRow({
      screen_time_pending_minutes:
        (selectedTotals.screen_time_pending_minutes || 0) + minutes,
      screen_time_pending_cost:
        (selectedTotals.screen_time_pending_cost || 0) + addedCost,
    });
    if (!updated) return;

    await insertActivityLog(
      `Requested ${minutes} min screen time (${addedCost} pts pending)`
    );
  };

  const approveScreenTime = async (minutes) => {
    if (!canManageRewards || !selectedTotals || !selectedProfile) return;

    const pendingMinutes = selectedTotals.screen_time_pending_minutes || 0;
    const pendingCost = selectedTotals.screen_time_pending_cost || 0;
    const currentPoints = selectedTotals.points || 0;
    const currentAvailable = selectedTotals.available_screen_time || 0;

    const approvedMinutes = Math.min(minutes, pendingMinutes);
    if (approvedMinutes <= 0) return;

    const costPer10 = selectedTotals.screen_time_cost_per_10 || 0;
    const blocksOf10 = Math.max(1, Math.round(approvedMinutes / 10));
    const approvalCost = Math.min(pendingCost, costPer10 * blocksOf10);

    if (currentPoints < approvalCost) return;

    const updated = await updateSelectedTotalsRow({
      points: currentPoints - approvalCost,
      screen_time_pending_minutes: pendingMinutes - approvedMinutes,
      screen_time_pending_cost: Math.max(0, pendingCost - approvalCost),
      available_screen_time: currentAvailable + approvedMinutes,
    });
    if (!updated) return;

    await insertActivityLog(
      `-${approvalCost} pts — Approved ${approvedMinutes} min screen time`
    );
  };

  const useScreenTime = async (minutes) => {
    if (!selectedTotals || !selectedProfile) return;

    const currentAvailable = selectedTotals.available_screen_time || 0;
    const currentUsed = selectedTotals.used_screen_time || 0;

    if (currentAvailable < minutes) return;

    const updated = await updateSelectedTotalsRow({
      available_screen_time: currentAvailable - minutes,
      used_screen_time: currentUsed + minutes,
    });
    if (!updated) return;

    await insertActivityLog(`Used ${minutes} min screen time`);
  };
  const applyDeduction = async () => {
    if (!canSeeParentControls || !selectedTotals || !selectedProfile || !dbProfile) return;

    const trimmedReason = newDeduction.reason.trim();
    const deductionPoints = Math.max(0, Number(newDeduction.points) || 0);

    if (!trimmedReason || deductionPoints <= 0) return;

    const updatedTotals = await updateSelectedTotalsRow({
      points: Math.max(0, (selectedTotals.points || 0) - deductionPoints),
    });

    if (!updatedTotals) return;

    const { error } = await supabase.from("deduction_log").insert({
      profile_id: selectedProfile.id,
      reason: trimmedReason,
      points: deductionPoints,
      created_by_profile_id: dbProfile.id,
      created_by_name: dbProfile.name,
    });

    if (error) {
      console.log("Deduction log insert error:", error.message);
      return;
    }
    await insertActivityLog(`-${deductionPoints} pts — Deduction: ${trimmedReason}`);
    const { data: refreshedDeductions, error: refreshError } = await supabase
      .from("deduction_log")
      .select("*")
      .eq("profile_id", selectedProfile.id)
      .order("created_at", { ascending: false });

    if (!refreshError) {
      setSelectedDeductions(refreshedDeductions || []);
    }

    setNewDeduction({
      reason: "",
      points: 10,
    });
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      alert("Enter the email address first.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password reset email sent.");
  };

  const handleResetPassword = async () => {
    if (!resetPassword || resetPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    if (resetPassword !== resetPasswordConfirm) {
      alert("Passwords do not match.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: resetPassword,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password updated. Please sign in again.");

    setResetPassword("");
    setResetPasswordConfirm("");
    setIsResetPasswordPage(false);

    window.history.replaceState({}, "", "/");

    await supabase.auth.signOut();
  };

  const handleSendRecoveryEmail = async () => {
    if (!isOwner) {
      alert("Only the owner can send password recovery emails.");
      return;
    }

    const selectedUser = passwordRecoveryProfiles.find(
      (profile) => profile.id === selectedRecoveryProfileId
    );

    if (!selectedUser?.email) {
      alert("Select a user with an email address.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(selectedUser.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert(`Password recovery email sent to ${selectedUser.email}`);
  };

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleCreateUser = async () => {
    if (!isOwner) {
      alert("Only the owner can create users.");
      return;
    }

    if (
      !newUserForm.name.trim() ||
      !newUserForm.age ||
      !newUserForm.role ||
      !newUserForm.email.trim() ||
      !newUserForm.password.trim() ||
      !newUserForm.household_id
    ) {
      alert("Please fill out all fields, including family.");
      return;
    }

    const { data, error } = await supabase.functions.invoke("create-user", {
      body: {
        ...newUserForm,
        household_id: newUserForm.household_id,
      },
    });

    if (error) {
      alert(error.message || "Failed to create user");
      return;
    }

    if (data?.error) {
      alert(data.error);
      return;
    }

    alert("User created successfully!");

    setNewUserForm({
      name: "",
      age: "",
      role: "child",
      email: "",
      password: "",
      household_id: "",
    });
  };

  const cleanExternalMessage = (value) => {
    if (typeof value !== "string") return "Stay focused and do your best today.";

    return value
      .replace(/[<>]/g, "")
      .replace(/javascript:/gi, "")
      .trim()
      .slice(0, 240);
  };

  const fetchDailyMessage = async () => {
    try {
      const type = Math.floor(Math.random() * 3);

      if (type === 0) {
        const res = await fetch("https://icanhazdadjoke.com/", {
          headers: { Accept: "application/json" },
        });
        const data = await res.json();

        setDailyMessage({
          label: "Dad Joke of the Day",
          text: cleanExternalMessage(data.joke),
          emoji: "😂",
        });
        return;
      }

      if (type === 1) {
        const res = await fetch("https://api.quotable.io/random");
        const data = await res.json();

        setDailyMessage({
          label: "Motivation Boost",
          text: cleanExternalMessage(`${data.content} — ${data.author}`),
          emoji: "💪",
        });
        return;
      }

      const res = await fetch("https://uselessfacts.jsph.pl/random.json?language=en");
      const data = await res.json();

      setDailyMessage({
        label: "Fun Fact",
        text: cleanExternalMessage(data.text),
        emoji: "🤯",
      });
    } catch (err) {
      console.log("Daily message error:", err);

      setDailyMessage({
        label: "Today’s Boost",
        text: "Small steps still move you forward.",
        emoji: "✨",
      });
    }
  };

  if (isResetPasswordPage) {
    return (
      <div className="app">
        <div className="card" style={{ maxWidth: "420px", margin: "40px auto" }}>
          <h2>Reset Password</h2>
          <p>Enter your new password below.</p>

          <div className="form-block">
            <input
              type="password"
              placeholder="New password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
            />

            <input
              type="password"
              placeholder="Confirm new password"
              value={resetPasswordConfirm}
              onChange={(e) => setResetPasswordConfirm(e.target.value)}
            />

            <button onClick={handleResetPassword}>Update Password</button>
          </div>
        </div>
      </div>
    );
  }

  if (session && currentPage !== "users" && (!selectedProfile || !selectedTotals)) {
    return (
      <div className="app">
        <div className="card" style={{ maxWidth: "700px", margin: "40px auto" }}>
          <h2>Loading family data...</h2>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app">
        <div className="card" style={{ maxWidth: "420px", margin: "40px auto" }}>
          <h2>Login</h2>
          <p>Sign in to access your family dashboard.</p>

          <div className="form-block">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button onClick={handleSignIn}>Sign In</button>
            <button type="button" onClick={handleForgotPassword}>
              Forgot Password
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <h1>Family Goals & Rewards</h1>

          <div className="top-nav">
            <button
              className={currentPage === "dashboard" ? "nav-btn active-nav" : "nav-btn"}
              onClick={() => setCurrentPage("dashboard")}
            >
              Dashboard
            </button>

            <button
              className={currentPage === "chores" ? "nav-btn active-nav" : "nav-btn"}
              onClick={() => setCurrentPage("chores")}
            >
              Chores
            </button>

            <button
              className={currentPage === "hygiene" ? "nav-btn active-nav" : "nav-btn"}
              onClick={() => setCurrentPage("hygiene")}
            >
              Hygiene
            </button>

            <button
              className={currentPage === "tasks" ? "nav-btn active-nav" : "nav-btn"}
              onClick={() => setCurrentPage("tasks")}
            >
              Tasks
            </button>

            <button
              className={currentPage === "rewards" ? "nav-btn active-nav" : "nav-btn"}
              onClick={() => setCurrentPage("rewards")}
            >
              Rewards
            </button>
            <button
              className={currentPage === "deductions" ? "nav-btn active-nav" : "nav-btn"}
              onClick={() => setCurrentPage("deductions")}
            >
              Deductions
            </button>
            {isOwner && (
              <button
                className={currentPage === "users" ? "nav-btn active-nav" : "nav-btn"}
                onClick={() => setCurrentPage("users")}
              >
                Users
              </button>
            )}
          </div>

          <div className="daily-banner">
            <div className="daily-banner-icon">{dailyMessage.emoji}</div>

            <div className="daily-banner-text">
              <strong>{dailyMessage.label}</strong>
              <span>{dailyMessage.text}</span>
            </div>

            <button
              type="button"
              className="daily-banner-refresh"
              onClick={fetchDailyMessage}
            >
              New
            </button>
          </div>
          <div className="live-datetime">
            {now.toLocaleString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
        </div>
        <div className="pill-row">
          <span className="pill">{dbProfile?.name || "Loading..."}</span>
          <span className="pill">{currentRole || "Loading..."}</span>
          <button type="button" className="nav-btn" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </header>

      <section className="stats">
        <div className="card">
          <h3>Family Points</h3>
          <strong>{totals.points}</strong>
        </div>
        <div className="card">
          <h3>Reading Minutes</h3>
          <strong>{totals.readingMinutes}</strong>
        </div>
        <div className="card">
          <h3>Learning Minutes</h3>
          <strong>{totals.learningMinutes}</strong>
        </div>
        <div className="card">
          <h3>Chores Done</h3>
          <strong>{totals.choresDone}</strong>
        </div>
      </section>


      {currentPage === "dashboard" && (
        <div className="main-grid">
          <div className="left-column">
            <aside className="card sidebar">
              <h2>Kids</h2>

              {childProfiles.map((kid) => {
                const kidTotals = allTotalsByProfileId[kid.id];
                const points = Number(kidTotals?.points ?? 0);
                const weeklyGoal = Number(kidTotals?.weekly_goal ?? 100);
                const pct =
                  weeklyGoal > 0
                    ? Math.min(100, Math.round((points / weeklyGoal) * 100))
                    : 0;

                return (
                  <button
                    key={kid.id}
                    className={`kid-button ${selectedProfileId === kid.id ? "active" : ""}`}
                    onClick={() => setSelectedProfileId(kid.id)}
                  >
                    <div className="kid-top">
                      <span>{kid.name}</span>
                      <span>{points} pts</span>
                    </div>

                    <small>Age {kid.age} • Weekly goal {weeklyGoal}</small>

                    <div className="progress">
                      <div className="progress-bar" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </aside>
          </div>

          <main className="content">
            <section className="card">
              <h2>{selectedKid.name}'s Overview</h2>
              <p>Quick snapshot of progress and activity.</p>

              <div className="summary-grid">
                <div className="card system-card reading-card">
                  <h3>Reading</h3>

                  <div className="system-stats">
                    <div className="system-stat">
                      <span>Today</span>
                      <strong>{selectedKid.readingToday} min</strong>
                    </div>

                    <div className="system-stat">
                      <span>Daily Goal</span>
                      <strong>{selectedKid.dailyReadingGoal} min</strong>
                    </div>

                    <div className="system-stat">
                      <span>Debt</span>
                      <strong>{selectedKid.readingDebt} min</strong>
                    </div>

                    <div className="system-stat">
                      <span>Bank</span>
                      <strong>{selectedKid.readingBank} min</strong>
                    </div>

                    <div className="system-stat">
                      <span>Points / 10</span>
                      <strong>{selectedKid.readingPointsPer10}</strong>
                    </div>
                  </div>

                  <div className="pill-action-group reading-actions">
                    <button onClick={() => addMinutes("reading", 10)}>+10</button>
                    <button onClick={() => addMinutes("reading", 20)}>+20</button>
                    <button onClick={() => addMinutes("reading", 30)}>+30</button>
                  </div>

                  {canSeeParentControls && (
                    <div className="screen-tools-row">
                      <div className="screen-cost-inline">
                        <label>Daily Reading Goal</label>
                        <div className="screen-cost-controls">
                          <input
                            type="number"
                            value={readingGoalInput}
                            onChange={(e) => setReadingGoalInput(e.target.value)}
                          />
                          <button onClick={updateDailyReadingGoal}>Set</button>
                        </div>
                      </div>

                      <div className="screen-cost-inline">
                        <label>Reading Points Per 10</label>
                        <div className="screen-cost-controls">
                          <input
                            type="number"
                            value={readingPointsInput}
                            onChange={(e) => setReadingPointsInput(e.target.value)}
                          />
                          <button onClick={updateReadingPointsValue}>Set</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="card system-card screen-card">
                  <h3>Screen Time</h3>

                  <div className="system-stats">
                    <div className="system-stat">
                      <span>Available</span>
                      <strong>{selectedKid.availableScreenTime} min</strong>
                    </div>

                    <div className="system-stat">
                      <span>Used</span>
                      <strong>{selectedKid.usedScreenTime} min</strong>
                    </div>

                    <div className="system-stat">
                      <span>Pending</span>
                      <strong>{selectedKid.screenTimePendingMinutes} min</strong>
                    </div>

                    <div className="system-stat">
                      <span>Pending Cost</span>
                      <strong>{selectedKid.screenTimePendingCost} pts</strong>
                    </div>

                    <div className="system-stat">
                      <span>Cost / 10</span>
                      <strong>{selectedKid.screenTimeCostPer10} pts</strong>
                    </div>
                  </div>

                  <div className="screen-action-stack">
                    <div className="pill-action-group request-actions-clean">
                      <button onClick={() => requestScreenTime(10)}>Request 10</button>
                      <button onClick={() => requestScreenTime(20)}>Request 20</button>
                    </div>

                    <div className="pill-action-group use-actions-clean">
                      <button onClick={() => useScreenTime(10)}>Use 10</button>
                      <button onClick={() => useScreenTime(20)}>Use 20</button>
                    </div>
                  </div>

                  {canSeeParentControls && (
                    <div className="screen-tools-row">
                      <div className="pill-action-group approve-actions-clean">
                        <button onClick={() => approveScreenTime(10)}>Approve 10</button>
                        <button onClick={() => approveScreenTime(20)}>Approve 20</button>
                      </div>

                      <div className="screen-cost-inline">
                        <label>Screen Cost Per 10</label>
                        <div className="screen-cost-controls">
                          <input
                            type="number"
                            value={screenCostInput}
                            onChange={(e) => setScreenCostInput(e.target.value)}
                          />
                          <button onClick={applyScreenCost}>Set</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="card">
              <h2>Recent Activity</h2>

              {getRecentActivity(selectedKid.activity, currentRole).length === 0 ? (
                <p className="activity-empty">No recent activity.</p>
              ) : (
                <div className="activity-scroll">
                  {getRecentActivity(selectedKid.activity, currentRole).map((item, index) => (
                    <div
                      key={item.id}
                      className={`activity-row compact ${index >= 5 ? "activity-extra" : ""}`}
                    >
                      <div>
                        <strong>{item.text}</strong>
                        <small>
                          {item.by} •{" "}
                          {item.timestamp ? formatDateTime(item.timestamp) : item.time}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>
      )}
      {currentPage === "chores" && (
        <div className="main-grid">
          <div className="left-column">
            <aside className="card sidebar">
              <h2>Kids</h2>
              {childProfiles.map((kid) => {
                const kidTotals = allTotalsByProfileId[kid.id];
                const points = Number(kidTotals?.points ?? 0);
                const weeklyGoal = Number(kidTotals?.weekly_goal ?? 100);
                const pct =
                  weeklyGoal > 0
                    ? Math.min(100, Math.round((points / weeklyGoal) * 100))
                    : 0;

                return (
                  <button
                    key={kid.id}
                    className={`kid-button ${selectedProfileId === kid.id ? "active" : ""}`}
                    onClick={() => setSelectedProfileId(kid.id)}
                  >
                    <div className="kid-top">
                      <span>{kid.name}</span>
                      <span>{points} pts</span>
                    </div>
                    <small>Age {kid.age} • Weekly goal {weeklyGoal}</small>
                    <div className="progress">
                      <div className="progress-bar" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </aside>

            {canSeeParentControls && (
              <aside className="card parent-tile">
                <h2>Add Chore</h2>
                <p className="admin-note">Add a chore for {selectedKid.name}.</p>

                <div className="form-block">
                  <input
                    placeholder="Chore name"
                    value={newChore.title}
                    onChange={(e) => setNewChore({ ...newChore, title: e.target.value })}
                  />

                  <input
                    type="number"
                    placeholder="Points"
                    value={newChore.points}
                    onChange={(e) => setNewChore({ ...newChore, points: e.target.value })}
                  />

                  <select
                    value={newChore.frequency}
                    onChange={(e) => setNewChore({ ...newChore, frequency: e.target.value })}
                  >
                    <option>Daily</option>
                    <option>Weekly</option>
                    <option>Monthly</option>
                    <option>One-Time</option>
                  </select>

                  <button onClick={() => addItem("chores", newChore)}>Add Chore</button>
                </div>
              </aside>
            )}
          </div>

          <main className="content">
            <section className="card">
              <h2>{selectedKid.name}'s Chores</h2>
              <p>Check off chores when they are completed.</p>

              {selectedKid.chores.filter((item) => canSeeParentControls || item.is_active !== false).length === 0 ? (
                <p className="activity-empty">No chores added yet.</p>
              ) : (
                selectedKid.chores
                  .filter((item) => canSeeParentControls || item.is_active !== false)
                  .map((item) => (
                    <div key={item.id} className="task-row">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggleItem(item.id, "chores")}
                      />

                      <div className="task-text">
                        <span className={item.done ? "done" : ""}>{item.title}</span>
                        <small>{item.frequency}</small>
                      </div>

                      <span>+{item.points}</span>

                      {canDeleteItems && (
                        <button
                          type="button"
                          onClick={() => deleteItem("chores", item.id)}
                          className="delete-btn"
                        >
                          X
                        </button>
                      )}
                    </div>
                  ))
              )}
            </section>
          </main>
        </div>
      )}
      {currentPage === "hygiene" && (
        <div className="main-grid">
          <div className="left-column">
            <aside className="card sidebar">
              <h2>Kids</h2>
              {childProfiles.map((kid) => {
                const kidTotals = allTotalsByProfileId[kid.id];
                const points = Number(kidTotals?.points ?? 0);
                const weeklyGoal = Number(kidTotals?.weekly_goal ?? 100);
                const pct =
                  weeklyGoal > 0
                    ? Math.min(100, Math.round((points / weeklyGoal) * 100))
                    : 0;

                return (
                  <button
                    key={kid.id}
                    className={`kid-button ${selectedProfileId === kid.id ? "active" : ""}`}
                    onClick={() => setSelectedProfileId(kid.id)}
                  >
                    <div className="kid-top">
                      <span>{kid.name}</span>
                      <span>{points} pts</span>
                    </div>
                    <small>Age {kid.age} • Weekly goal {weeklyGoal}</small>
                    <div className="progress">
                      <div className="progress-bar" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </aside>

            {canSeeParentControls && (
              <aside className="card parent-tile">
                <h2>Add Hygiene</h2>
                <p className="admin-note">Add hygiene item for {selectedKid.name}.</p>

                <div className="form-block">
                  <input
                    placeholder="Hygiene name"
                    value={newHygiene.title}
                    onChange={(e) => setNewHygiene({ ...newHygiene, title: e.target.value })}
                  />

                  <input
                    type="number"
                    placeholder="Points"
                    value={newHygiene.points}
                    onChange={(e) => setNewHygiene({ ...newHygiene, points: e.target.value })}
                  />

                  <select
                    value={newHygiene.frequency}
                    onChange={(e) => setNewHygiene({ ...newHygiene, frequency: e.target.value })}
                  >
                    <option>Morning</option>
                    <option>Evening</option>
                    <option>Daily</option>
                    <option>Weekly</option>
                    <option>Monthly</option>
                    <option>One-Time</option>
                  </select>

                  <button onClick={() => addItem("hygiene", newHygiene)}>
                    Add Hygiene
                  </button>
                </div>
              </aside>
            )}
          </div>

          <main className="content">
            <section className="card">
              <h2>{selectedKid.name}'s Hygiene</h2>
              <p>Track daily and weekly hygiene habits.</p>

              {selectedKid.hygiene.filter((item) => canSeeParentControls || item.is_active !== false).length === 0 ? (
                <p className="activity-empty">No hygiene items added yet.</p>
              ) : (
                selectedKid.hygiene
                  .filter((item) => canSeeParentControls || item.is_active !== false)
                  .map((item) => (
                    <div key={item.id} className="task-row">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggleItem(item.id, "hygiene")}
                      />

                      <div className="task-text">
                        <span className={item.done ? "done" : ""}>{item.title}</span>
                        <small>{item.frequency}</small>
                      </div>

                      <span>+{item.points}</span>

                      {canDeleteItems && (
                        <button
                          type="button"
                          onClick={() => deleteItem("hygiene", item.id)}
                          className="delete-btn"
                        >
                          X
                        </button>
                      )}
                    </div>
                  ))
              )}
            </section>
          </main>
        </div>
      )}
      {currentPage === "tasks" && (
        <div className="main-grid">
          <div className="left-column">
            <aside className="card sidebar">
              <h2>Kids</h2>
              {childProfiles.map((kid) => {
                const kidTotals = allTotalsByProfileId[kid.id];
                const points = Number(kidTotals?.points ?? 0);
                const weeklyGoal = Number(kidTotals?.weekly_goal ?? 100);
                const pct =
                  weeklyGoal > 0
                    ? Math.min(100, Math.round((points / weeklyGoal) * 100))
                    : 0;

                return (
                  <button
                    key={kid.id}
                    className={`kid-button ${selectedProfileId === kid.id ? "active" : ""}`}
                    onClick={() => setSelectedProfileId(kid.id)}
                  >
                    <div className="kid-top">
                      <span>{kid.name}</span>
                      <span>{points} pts</span>
                    </div>
                    <small>Age {kid.age} • Weekly goal {weeklyGoal}</small>
                    <div className="progress">
                      <div className="progress-bar" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </aside>

            {canSeeParentControls && (
              <aside className="card parent-tile">
                <h2>Add Task</h2>
                <p className="admin-note">
                  Add a shared household task. It will be visible to every child in this household.
                </p>

                <div className="form-block">
                  <input
                    placeholder="Task name"
                    value={newTaskItem.title}
                    onChange={(e) => setNewTaskItem({ ...newTaskItem, title: e.target.value })}
                  />

                  <input
                    type="number"
                    placeholder="Points"
                    value={newTaskItem.points}
                    onChange={(e) => setNewTaskItem({ ...newTaskItem, points: e.target.value })}
                  />

                  <select
                    value={newTaskItem.frequency}
                    onChange={(e) => setNewTaskItem({ ...newTaskItem, frequency: e.target.value })}
                  >
                    <option>Daily</option>
                    <option>Weekly</option>
                    <option>Monthly</option>
                    <option>One-Time</option>
                  </select>

                  <button onClick={() => addItem("tasks", newTaskItem)}>
                    Add Task
                  </button>
                </div>
              </aside>
            )}
          </div>

          <main className="content">
            <section className="card">
              <h2>Household Tasks</h2>
              <p>
                Household tasks are shared by everyone in this home. These are bigger jobs
                that are not assigned to one child. Whoever completes the task first earns
                the points. Daily, weekly, monthly, and one-time reset rules still apply.
              </p>

              {selectedKid.tasks.filter((item) => canSeeParentControls || item.is_active !== false).length === 0 ? (
                <p className="activity-empty">No tasks added yet.</p>
              ) : (
                selectedKid.tasks
                  .filter((item) => canSeeParentControls || item.is_active !== false)
                  .map((item) => (
                    <div key={item.id} className="task-row">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggleItem(item.id, "tasks")}
                      />

                      <div className="task-text">
                        <span className={item.done ? "done" : ""}>{item.title}</span>
                        <small>{item.frequency}</small>
                      </div>

                      <span>+{item.points}</span>

                      {canDeleteItems && (
                        <button
                          type="button"
                          onClick={() => deleteItem("tasks", item.id)}
                          className="delete-btn"
                        >
                          X
                        </button>
                      )}
                    </div>
                  ))
              )}
            </section>
          </main>
        </div>
      )}
      {currentPage === "rewards" && (
        <div className="main-grid">
          <div className="left-column">
            <aside className="card sidebar">
              <h2>Kids</h2>
              {childProfiles.map((kid) => (
                <button
                  key={kid.id}
                  className={`kid-button ${selectedProfileId === kid.id ? "active" : ""}`}
                  onClick={() => setSelectedProfileId(kid.id)}
                >
                  <div className="kid-top">
                    <span>{kid.name}</span>
                    <span>{kid.id === selectedProfile?.id ? selectedKid?.points ?? 0 : 0} pts</span>
                  </div>
                  <small>Reward Center</small>
                </button>
              ))}
            </aside>

            {canSeeParentControls && (
              <aside className="card parent-tile">
                <h2>Parental Controls</h2>

                <div className="form-block">
                  <h3>Add Reward</h3>

                  <input
                    placeholder="Reward title"
                    value={newReward.title}
                    onChange={(e) => setNewReward({ ...newReward, title: e.target.value })}
                  />

                  <input
                    type="number"
                    placeholder="Point cost"
                    value={newReward.cost}
                    onChange={(e) => setNewReward({ ...newReward, cost: e.target.value })}
                  />

                  <button onClick={addReward}>Add Reward</button>
                </div>
              </aside>
            )}

            <aside className="card parent-tile">
              <h2>Request Reward</h2>

              <input
                placeholder="Reward idea"
                value={newRewardRequest.title}
                onChange={(e) =>
                  setNewRewardRequest({ ...newRewardRequest, title: e.target.value })
                }
              />

              <input
                type="number"
                placeholder="Suggested points"
                value={newRewardRequest.suggestedPoints}
                onChange={(e) =>
                  setNewRewardRequest({
                    ...newRewardRequest,
                    suggestedPoints: e.target.value,
                  })
                }
              />

              <input
                placeholder="Link (Amazon, etc)"
                value={newRewardRequest.link}
                onChange={(e) =>
                  setNewRewardRequest({ ...newRewardRequest, link: e.target.value })
                }
              />

              <textarea
                placeholder="Notes"
                value={newRewardRequest.note}
                onChange={(e) =>
                  setNewRewardRequest({ ...newRewardRequest, note: e.target.value })
                }
              />

              <button onClick={addRewardRequest}>Submit Request</button>
            </aside>
          </div>

          <main className="content">
            <section className="card">
              <h2>{selectedKid.name} Rewards</h2>
            </section>

            <section className="two-col">
              <div className="card">
                <h2>Active Rewards</h2>

                {selectedKid.rewards.filter((r) => r.status === "available").length === 0 ? (
                  <p className="activity-empty">No active rewards yet.</p>
                ) : (
                  selectedKid.rewards
                    .filter((r) => r.status === "available")
                    .map((reward) => {
                      const canRedeem = selectedKid.points >= reward.cost && !reward.claimed;

                      return (
                        <div key={reward.id} className="reward-row">
                          <div>
                            <strong>{reward.title}</strong>
                            <small>{reward.cost} points</small>
                          </div>

                          <div className="reward-actions">
                            <button
                              disabled={!canRedeem}
                              onClick={() => redeemReward(reward.id)}
                            >
                              {reward.claimed ? "Claimed" : canRedeem ? "Redeem" : "Not enough"}
                            </button>

                            {canDeleteItems && (
                              <button
                                type="button"
                                className="delete-btn small"
                                onClick={() => deleteReward(reward.id)}
                              >
                                X
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              <div className="card">
                <h2>Requests</h2>

                {(() => {
                  const visibleRequests = (selectedKid.rewardRequests || []).filter((req) => {
                    if (req.status === "Pending") return true;
                    return !req.viewed;
                  });

                  return visibleRequests.length === 0 ? (
                    <p>No reward requests yet.</p>
                  ) : (
                    visibleRequests.map((req) => {
                      const isPending = req.status === "Pending";
                      const isResolved = req.status === "Approved" || req.status === "Denied";
                      const approvalValue =
                        requestApprovalEdits[req.id] ?? req.approvedCost ?? req.suggestedPoints;

                      return (
                        <div key={req.id} className="request-row">
                          <div className="request-top">
                            <div>
                              <h3 className="request-title">{req.title}</h3>
                              <p className="request-meta">
                                Requested by <strong>{req.requestedBy}</strong>
                              </p>
                            </div>

                            <div className="request-badges">
                              <span className="request-points">
                                {req.approvedCost ?? req.suggestedPoints} pts
                              </span>
                              <span className="request-status">{req.status}</span>
                            </div>
                          </div>

                          {req.note ? <p className="request-note">{req.note}</p> : null}

                          {req.link ? (
                            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                              <span
                                style={{
                                  fontSize: "0.8rem",
                                  color: "#aaa",
                                  background: "#222",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  userSelect: "text",
                                  cursor: "text",
                                  wordBreak: "break-all",
                                }}
                              >
                                {req.link}
                              </span>

                              <a
                                className="request-link"
                                href={req.link.startsWith("http") ? req.link : `https://${req.link}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open Link
                              </a>
                            </div>
                          ) : null}

                          {canManageRewards && isPending && (
                            <div className="request-actions">
                              <div className="request-edit-block">
                                <label className="request-label">Final point cost</label>
                                <input
                                  type="number"
                                  value={approvalValue}
                                  onChange={(e) =>
                                    setRequestApprovalEdits((prev) => ({
                                      ...prev,
                                      [req.id]: e.target.value,
                                    }))
                                  }
                                />
                              </div>

                              <div className="request-action-buttons">
                                <button onClick={() => approveRewardRequest(req.id)}>
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="deny-btn"
                                  onClick={() => denyRewardRequest(req.id)}
                                >
                                  Deny
                                </button>
                              </div>
                            </div>
                          )}

                          {!canManageRewards && isResolved && (
                            <div className="request-actions">
                              <div className="request-action-buttons">
                                <button onClick={() => acknowledgeRewardRequest(req.id)}>
                                  Acknowledge
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  );
                })()}
              </div>
            </section>
            {canManageRewards && (
              <section className="card">
                <h2>{isOwner ? "All Rewards Awaiting Fulfillment" : "Rewards I Need to Fulfill"}</h2>

                {pendingFulfillmentRewards.length === 0 ? (
                  <p>No rewards are waiting for fulfillment.</p>
                ) : (
                  pendingFulfillmentRewards.map((reward) => {
                    const childName = childProfilesById[reward.profile_id]?.name || "Unknown Child";

                    return (
                      <div key={reward.id} className="reward-row fulfillment-row">
                        <div className="fulfillment-text">
                          <div className="fulfillment-title-row">
                            <strong className="fulfillment-title">{reward.title}</strong>
                            <span className="fulfillment-points">{reward.cost} pts</span>
                          </div>

                          <small className="fulfillment-meta">
                            {childName} • Redeemed{" "}
                            {reward.redeemed_at ? formatDateTime(reward.redeemed_at) : "recently"}
                          </small>

                          <small className="fulfillment-meta">
                            Assigned to {reward.assigned_parent_name || "Unknown Parent"}
                          </small>
                        </div>

                        <div className="reward-actions">
                          <button className="fulfillment-btn" onClick={() => markRewardFulfilled(reward.id)}>
                            Mark Fulfilled
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </section>
            )}
          </main>
        </div>
      )}
      {currentPage === "deductions" && (
        <div className="main-grid">
          <div className="left-column">
            <aside className="card sidebar">
              <h2>Kids</h2>
              {childProfiles.map((kid) => (
                <button
                  key={kid.id}
                  className={`kid-button ${selectedProfileId === kid.id ? "active" : ""}`}
                  onClick={() => setSelectedProfileId(kid.id)}
                >
                  <div className="kid-top">
                    <span>{kid.name}</span>
                    <span>{kid.id === selectedProfile?.id ? selectedKid?.points ?? 0 : 0} pts</span>
                  </div>
                  <small>Deductions Center</small>
                </button>
              ))}
            </aside>

            {canSeeParentControls && (
              <aside className="card parent-tile">
                <h2>Apply Deduction</h2>
                <p className="admin-note">
                  Remove points with a typed reason. This stays visible in history.
                </p>

                <div className="form-block">
                  <input
                    placeholder="Reason for deduction"
                    value={newDeduction.reason}
                    onChange={(e) =>
                      setNewDeduction({ ...newDeduction, reason: e.target.value })
                    }
                  />

                  <input
                    type="number"
                    min="1"
                    placeholder="Points to remove"
                    value={newDeduction.points}
                    onChange={(e) =>
                      setNewDeduction({ ...newDeduction, points: e.target.value })
                    }
                  />

                  <button onClick={applyDeduction}>
                    Apply Deduction
                  </button>
                </div>
              </aside>
            )}
          </div>

          <main className="content">
            <section className="card">
              <h2>{selectedKid.name} Deductions</h2>
              <p>Transparent point removals with reasons.</p>

              <div className="summary-grid">
                <div className="mini-card">
                  <span>Current Points</span>
                  <strong>{selectedKid.points}</strong>
                </div>

                <div className="mini-card">
                  <span>Total Deductions</span>
                  <strong>{(selectedKid.deductions || []).length}</strong>
                </div>

                <div className="mini-card">
                  <span>Total Points Removed</span>
                  <strong>
                    {(selectedKid.deductions || []).reduce(
                      (sum, item) => sum + (Number(item.points) || 0),
                      0
                    )} pts
                  </strong>
                </div>
              </div>
            </section>

            <section className="card">
              <h2>Deduction History</h2>

              {(selectedKid.deductions || []).length === 0 ? (
                <p className="activity-empty">No deductions yet.</p>
              ) : (
                selectedKid.deductions.map((item) => (
                  <div key={item.id} className="deduction-row">
                    <div className="task-text">
                      <strong>{item.reason}</strong>
                      <small>
                        {item.by} • {item.timestamp ? formatDateTime(item.timestamp) : ""}
                      </small>
                    </div>
                    <span className="deduction-points">-{item.points} pts</span>
                  </div>
                ))
              )}
            </section>
          </main>
        </div>
      )}
      {currentPage === "users" && isOwner && (
        <div className="main-grid">
          <div className="left-column">
            <aside className="card parent-tile">
              <h2>Create User</h2>
              <p className="admin-note">
                Owner-only setup for new parent or child accounts.
              </p>

              <div className="form-block">
                <input
                  placeholder="Name"
                  value={newUserForm.name}
                  onChange={(e) =>
                    setNewUserForm({ ...newUserForm, name: e.target.value })
                  }
                />

                <input
                  type="number"
                  placeholder="Age"
                  value={newUserForm.age}
                  onChange={(e) =>
                    setNewUserForm({ ...newUserForm, age: e.target.value })
                  }
                />

                <select
                  value={newUserForm.role}
                  onChange={(e) =>
                    setNewUserForm({ ...newUserForm, role: e.target.value })
                  }
                >
                  <option value="parent">Parent</option>
                  <option value="child">Child</option>
                </select>

                <select
                  value={newUserForm.household_id}
                  onChange={(e) =>
                    setNewUserForm({ ...newUserForm, household_id: e.target.value })
                  }
                >
                  <option value="">Select Family</option>
                  {households.map((household) => (
                    <option key={household.id} value={household.id}>
                      {household.name}
                    </option>
                  ))}
                </select>

                <input
                  type="email"
                  placeholder="Email"
                  value={newUserForm.email}
                  onChange={(e) =>
                    setNewUserForm({ ...newUserForm, email: e.target.value })
                  }
                />

                <input
                  type="password"
                  placeholder="Temporary Password"
                  value={newUserForm.password}
                  onChange={(e) =>
                    setNewUserForm({ ...newUserForm, password: e.target.value })
                  }
                />

                <button onClick={handleCreateUser}>Create User</button>
              </div>
            </aside>
            <aside className="card parent-tile">
              <h2>Password Recovery</h2>
              <p className="admin-note">
                Send a password reset email to an existing user.
              </p>

              <div className="form-block">
                <select
                  value={selectedRecoveryProfileId}
                  onChange={(e) => setSelectedRecoveryProfileId(e.target.value)}
                >
                  <option value="">Select User</option>
                  {passwordRecoveryProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} ({profile.role}) - {profile.email || "No email"}
                    </option>
                  ))}
                </select>

                <button onClick={handleSendRecoveryEmail}>
                  Send Password Recovery Email
                </button>
              </div>
            </aside>
          </div>

          <main className="content">
            <section className="card">
              <h2>Users</h2>
              <p>
                This page will become the owner control center for creating
                parent and child accounts.
              </p>

              <div className="summary-grid">
                <div className="mini-card">
                  <span>Name</span>
                  <strong>{newUserForm.name || "-"}</strong>
                </div>
                <div className="mini-card">
                  <span>Age</span>
                  <strong>{newUserForm.age || "-"}</strong>
                </div>
                <div className="mini-card">
                  <span>Role</span>
                  <strong>{newUserForm.role}</strong>
                </div>
                <div className="mini-card">
                  <span>Email</span>
                  <strong>{newUserForm.email || "-"}</strong>
                </div>
              </div>
            </section>
          </main>
        </div>
      )}
    </div>
  );
}

export default App;